using System.Collections.Concurrent;
using System.Data;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using Microsoft.Data.SqlClient;

namespace VetDuAtImporter;

internal static class Program
{
    private const string ApiBase = "https://vetduatbffapi.tradesolution.no";
    private const string Origin = "https://vetduat.no";
    // Dagligvare only (exclude storhusholdning / foodservice).
    private const string RetailFilter = "ErStorhusholdningsprodukt eq false";
    // Website uses top up to 100; wrapping in searchBody capped top at 10 and broke filters.
    private const int PageSize = 100;
    private const int SearchWorkers = 8;
    private const int SqlBatchSize = 100;

    private static readonly string[] Facets =
    [
        "Produksjonsland,count:10,sort:count",
        "AllergenerInneholder,count:10,sort:count",
        "AllergenerInneholderIkke,count:10,sort:count",
        "AllergenerKanInneholde,count:10,sort:count",
        "KategoriNavn,count:10,sort:count",
        "Varemerke,count:10,sort:count",
        "Varegruppenavn,count:10,sort:count",
        "FirmaNavn,count:10,sort:count",
        "MerkeOrdninger,count:10,sort:count",
        "ErStorhusholdningsprodukt,count:10,sort:count",
    ];

    // Empty facets on page requests — facet aggregation made search extremely slow.
    private static readonly string[] PageFacets = [];

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static async Task<int> Main(string[] args)
    {
        var connectionString = ResolveConnectionString();
        var workers = ParseInt(Env("VETDUAT_WORKERS"), 32);
        var limit = ParseNullableInt(Env("VETDUAT_LIMIT"));
        var startSkip = ParseInt(Env("VETDUAT_SKIP"), 0);
        // Default off for speed; set VETDUAT_WRITE_JSONL=1 to enable resume file.
        var writeJsonl = string.Equals(Env("VETDUAT_WRITE_JSONL"), "1", StringComparison.Ordinal);
        var jsonlPath = Env("VETDUAT_JSONL")
            ?? Path.GetFullPath(Path.Combine(
                FindRepoRoot(), "data", "vetduat-products.jsonl"));

        // Avoid thread-pool starvation under high fan-out HTTP.
        ThreadPool.SetMinThreads(Math.Max(workers * 2, 128), Math.Max(workers * 2, 128));

        Console.WriteLine($"Workers={workers} Limit={(limit?.ToString() ?? "all")} Skip={startSkip} Jsonl={(writeJsonl ? jsonlPath : "off")}");

        await EnsureSchemaAsync(connectionString);

        using var handler = new SocketsHttpHandler
        {
            MaxConnectionsPerServer = Math.Max(workers + 16, 64),
            PooledConnectionLifetime = TimeSpan.FromMinutes(2),
            AutomaticDecompression = DecompressionMethods.All,
        };
        using var http = new HttpClient(handler)
        {
            BaseAddress = new Uri(ApiBase),
            Timeout = TimeSpan.FromSeconds(60),
        };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("UtenGluten.VetDuAtImporter/1.0");
        http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        http.DefaultRequestHeaders.TryAddWithoutValidation("Origin", Origin);
        http.DefaultRequestHeaders.Referrer = new Uri($"{Origin}/product?q=");

        var totalCount = await GetRetailCountAsync(http).ConfigureAwait(false);
        var target = limit.HasValue ? Math.Min(totalCount, limit.Value) : totalCount;
        Console.WriteLine($"VetDuAt dagligvare count={totalCount} (filter={RetailFilter}); importing up to {target}");

        var seenGuids = new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        if (writeJsonl)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(jsonlPath)!);
        }

        if (writeJsonl && File.Exists(jsonlPath))
        {
            foreach (var line in File.ReadLines(jsonlPath))
            {
                try
                {
                    using var doc = JsonDocument.Parse(line);
                    if (doc.RootElement.TryGetProperty("variantIdentityGuid", out var g)
                        && g.GetString() is { Length: > 0 } guid)
                    {
                        seenGuids.TryAdd(guid, 0);
                    }
                }
                catch
                {
                    // skip bad lines
                }
            }
            Console.WriteLine($"Resuming with {seenGuids.Count} guids already in jsonl");
        }

        var guidChannel = Channel.CreateBounded<string>(new BoundedChannelOptions(workers * 8)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleWriter = false,
            SingleReader = false,
        });
        var rowChannel = Channel.CreateBounded<ProductRow>(new BoundedChannelOptions(workers * 8)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleWriter = false,
            SingleReader = true,
        });

        var cts = new CancellationTokenSource();
        var started = DateTime.UtcNow;
        var fetched = 0;
        var upserted = 0;
        var failed = 0;

        var firmChannel = Channel.CreateBounded<FirmInfo>(new BoundedChannelOptions(SearchWorkers * 2)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleWriter = true,
            SingleReader = false,
        });

        var firms = await GetFirmsAsync(http).ConfigureAwait(false);
        Console.WriteLine($"Partitioning by {firms.Count} suppliers (sum={firms.Sum(f => f.Count)})");

        var firmEnqueueTask = Task.Run(async () =>
        {
            foreach (var firm in firms)
            {
                await firmChannel.Writer.WriteAsync(firm, cts.Token).ConfigureAwait(false);
            }

            firmChannel.Writer.TryComplete();
        }, cts.Token);

        var searchTasks = Enumerable.Range(0, SearchWorkers)
            .Select(_ => Task.Run(() => SearchFirmWorkerAsync(
                http, firmChannel.Reader, guidChannel.Writer, cts.Token)))
            .ToArray();

        var detailTasks = Enumerable.Range(0, workers)
            .Select(_ => Task.Run(() => DetailWorkerAsync(
                http, guidChannel.Reader, rowChannel.Writer, seenGuids, writeJsonl ? jsonlPath : null,
                () => Interlocked.Increment(ref fetched),
                () => Interlocked.Increment(ref failed),
                cts.Token)))
            .ToArray();

        var sqlTask = Task.Run(() => SqlWriterAsync(
            connectionString, rowChannel.Reader,
            n => Interlocked.Add(ref upserted, n),
            cts.Token));

        var progress = Task.Run(async () =>
        {
            while (!cts.IsCancellationRequested)
            {
                await Task.Delay(5000, cts.Token).ConfigureAwait(false);
                var elapsed = DateTime.UtcNow - started;
                var rate = fetched / Math.Max(1.0, elapsed.TotalSeconds);
                var etaSec = rate > 0 ? (target - fetched) / rate : 0;
                Console.WriteLine(
                    $"progress fetched={fetched}/{target} upserted={upserted} failed={failed} " +
                    $"rate={rate:F1}/s elapsed={elapsed:hh\\:mm\\:ss} eta~{TimeSpan.FromSeconds(etaSec):hh\\:mm\\:ss}");
            }
        }, cts.Token);

        try
        {
            await firmEnqueueTask.ConfigureAwait(false);
            await Task.WhenAll(searchTasks).ConfigureAwait(false);
            guidChannel.Writer.TryComplete();
            await Task.WhenAll(detailTasks).ConfigureAwait(false);
            rowChannel.Writer.TryComplete();
            await sqlTask.ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex);
            cts.Cancel();
            return 1;
        }
        finally
        {
            cts.Cancel();
            try { await progress.ConfigureAwait(false); } catch { /* ignore */ }
        }

        var totalElapsed = DateTime.UtcNow - started;
        Console.WriteLine($"Done. fetched={fetched} upserted={upserted} failed={failed} elapsed={totalElapsed}");
        await PrintCountsAsync(connectionString).ConfigureAwait(false);
        return failed > 0 && fetched == 0 ? 1 : 0;
    }

    private static string? Env(string name) =>
        Environment.GetEnvironmentVariable(name);

    private static int ParseInt(string? value, int fallback) =>
        int.TryParse(value, out var n) ? n : fallback;

    private static int? ParseNullableInt(string? value) =>
        int.TryParse(value, out var n) ? n : null;

    private static string ResolveConnectionString()
    {
        var full = Env("GLUTENFRIDB_CONNECTION") ?? Env("ConnectionStrings__Default");
        if (!string.IsNullOrWhiteSpace(full))
        {
            return full;
        }

        var password = Env("SQLCMDPASSWORD") ?? Env("GLUTENFRIDB_PASSWORD");
        if (string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "Set GLUTENFRIDB_CONNECTION, or SQLCMDPASSWORD / GLUTENFRIDB_PASSWORD.");
        }

        var builder = new SqlConnectionStringBuilder
        {
            DataSource = "tcp:membercam-sql-529.database.windows.net,1433",
            InitialCatalog = "GlutenFridb",
            UserID = "membercamadmin",
            Password = password,
            Encrypt = true,
            TrustServerCertificate = false,
            ConnectTimeout = 60,
            CommandTimeout = 120,
        };
        return builder.ConnectionString;
    }

    private static async Task EnsureSchemaAsync(string connectionString)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync().ConfigureAwait(false);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            IF COL_LENGTH(N'dbo.glutenfri', N'ingredients') IS NULL
              ALTER TABLE dbo.glutenfri ADD ingredients NVARCHAR(MAX) NULL;
            IF COL_LENGTH(N'dbo.gluten', N'ingredients') IS NULL
              ALTER TABLE dbo.gluten ADD ingredients NVARCHAR(MAX) NULL;

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_glutenfri_barcode' AND object_id = OBJECT_ID(N'dbo.glutenfri'))
              CREATE INDEX IX_glutenfri_barcode ON dbo.glutenfri(barcode);
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_gluten_barcode' AND object_id = OBJECT_ID(N'dbo.gluten'))
              CREATE INDEX IX_gluten_barcode ON dbo.gluten(barcode);
            """;
        await cmd.ExecuteNonQueryAsync().ConfigureAwait(false);
        Console.WriteLine("Schema ok (ingredients + barcode indexes).");
    }

    private static async Task PrintCountsAsync(string connectionString)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync().ConfigureAwait(false);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT 'fri' AS tbl, COUNT(*) AS cnt FROM dbo.glutenfri
            UNION ALL SELECT 'gluten', COUNT(*) FROM dbo.gluten
            UNION ALL SELECT 'fri_with_ingredients', COUNT(*) FROM dbo.glutenfri WHERE ingredients IS NOT NULL
            UNION ALL SELECT 'gluten_with_ingredients', COUNT(*) FROM dbo.gluten WHERE ingredients IS NOT NULL;
            """;
        await using var reader = await cmd.ExecuteReaderAsync().ConfigureAwait(false);
        while (await reader.ReadAsync().ConfigureAwait(false))
        {
            Console.WriteLine($"{reader.GetString(0)}={reader.GetInt32(1)}");
        }
    }

    private static async Task<int> GetRetailCountAsync(HttpClient http)
    {
        var body = new
        {
            facets = Facets,
            top = 1,
            skip = 0,
            count = true,
            search = "*",
            filter = RetailFilter,
        };

        using var resp = await http.PostAsJsonAsync("/api/products/search", body).ConfigureAwait(false);
        resp.EnsureSuccessStatusCode();
        await using var stream = await resp.Content.ReadAsStreamAsync().ConfigureAwait(false);
        using var doc = await JsonDocument.ParseAsync(stream).ConfigureAwait(false);
        if (doc.RootElement.TryGetProperty("searchMetadata", out var meta)
            && meta.TryGetProperty("count", out var countEl)
            && countEl.TryGetInt32(out var count))
        {
            return count;
        }

        throw new InvalidOperationException("Could not read retail product count from search API.");
    }

    private sealed record FirmInfo(string Name, int Count);

    private static async Task<List<FirmInfo>> GetFirmsAsync(HttpClient http)
    {
        var body = new
        {
            facets = new[] { "FirmaNavn,count:5000,sort:count" },
            top = 1,
            skip = 0,
            count = true,
            search = "*",
            filter = RetailFilter,
        };

        using var resp = await http.PostAsJsonAsync("/api/products/search", body).ConfigureAwait(false);
        resp.EnsureSuccessStatusCode();
        await using var stream = await resp.Content.ReadAsStreamAsync().ConfigureAwait(false);
        using var doc = await JsonDocument.ParseAsync(stream).ConfigureAwait(false);

        var firms = new List<FirmInfo>();
        if (!doc.RootElement.TryGetProperty("facets", out var facets)
            || !facets.TryGetProperty("FirmaNavn", out var firma)
            || !firma.TryGetProperty("facets", out var list))
        {
            throw new InvalidOperationException("Could not read FirmaNavn facets from search API.");
        }

        foreach (var item in list.EnumerateArray())
        {
            var name = item.GetProperty("value").GetString();
            var count = item.GetProperty("count").GetInt32();
            if (!string.IsNullOrWhiteSpace(name) && count > 0)
            {
                firms.Add(new FirmInfo(name, count));
            }
        }

        return firms;
    }

    private static async Task SearchFirmWorkerAsync(
        HttpClient http,
        ChannelReader<FirmInfo> firms,
        ChannelWriter<string> writer,
        CancellationToken ct)
    {
        await foreach (var firm in firms.ReadAllAsync(ct).ConfigureAwait(false))
        {
            var firmEq = firm.Name.Replace("'", "''", StringComparison.Ordinal);
            var filter = $"{RetailFilter} and FirmaNavn eq '{firmEq}'";

            for (var skip = 0; skip < firm.Count; skip += PageSize)
            {
                var top = Math.Min(PageSize, firm.Count - skip);
                var body = new
                {
                    facets = PageFacets,
                    top,
                    skip,
                    count = false,
                    search = "*",
                    filter,
                };

                SearchResponse? result = null;
                for (var attempt = 0; attempt < 8; attempt++)
                {
                    try
                    {
                        using var resp = await http.PostAsJsonAsync("/api/products/search", body, ct)
                            .ConfigureAwait(false);
                        resp.EnsureSuccessStatusCode();
                        result = await resp.Content.ReadFromJsonAsync<SearchResponse>(JsonOpts, ct)
                            .ConfigureAwait(false);
                        break;
                    }
                    catch (Exception ex) when (attempt < 7)
                    {
                        var delay = TimeSpan.FromSeconds(Math.Min(20, Math.Pow(1.6, attempt)));
                        Console.WriteLine($"search retry firm={firm.Name} skip={skip}: {ex.Message}");
                        await Task.Delay(delay, ct).ConfigureAwait(false);
                    }
                }

                var products = result?.Products ?? [];
                if (products.Count == 0)
                {
                    break;
                }

                foreach (var p in products)
                {
                    if (!string.IsNullOrWhiteSpace(p.VariantIdentityGuid))
                    {
                        await writer.WriteAsync(p.VariantIdentityGuid, ct).ConfigureAwait(false);
                    }
                }
            }

            if (firm.Count >= 500)
            {
                Console.WriteLine($"search firm done: {firm.Name} ({firm.Count})");
            }
        }
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "package.json"))
                && Directory.Exists(Path.Combine(dir.FullName, "backend")))
            {
                return dir.FullName;
            }
            dir = dir.Parent;
        }

        return Directory.GetCurrentDirectory();
    }

    private static async Task DetailWorkerAsync(
        HttpClient http,
        ChannelReader<string> guids,
        ChannelWriter<ProductRow> rows,
        ConcurrentDictionary<string, byte> seenGuids,
        string? jsonlPath,
        Action onFetched,
        Action onFailed,
        CancellationToken ct)
    {
        await foreach (var guid in guids.ReadAllAsync(ct).ConfigureAwait(false))
        {
            if (seenGuids.ContainsKey(guid))
            {
                continue;
            }

            ProductDetail? detail = null;
            for (var attempt = 0; attempt < 6; attempt++)
            {
                try
                {
                    using var resp = await http.GetAsync($"/api/products/{guid}", ct).ConfigureAwait(false);
                    if (resp.StatusCode == HttpStatusCode.NotFound)
                    {
                        break;
                    }

                    if (resp.StatusCode == HttpStatusCode.TooManyRequests)
                    {
                        var retryAfter = resp.Headers.RetryAfter?.Delta ?? TimeSpan.FromSeconds(2 + attempt);
                        await Task.Delay(retryAfter, ct).ConfigureAwait(false);
                        continue;
                    }

                    resp.EnsureSuccessStatusCode();
                    detail = await resp.Content.ReadFromJsonAsync<ProductDetail>(JsonOpts, ct)
                        .ConfigureAwait(false);
                    break;
                }
                catch (Exception ex) when (attempt < 5)
                {
                    await Task.Delay(TimeSpan.FromSeconds(Math.Min(12, Math.Pow(1.5, attempt))), ct)
                        .ConfigureAwait(false);
                    if (attempt == 4)
                    {
                        Console.WriteLine($"detail fail {guid}: {ex.Message}");
                    }
                }
            }

            var row = Normalize(detail);
            if (row is null)
            {
                onFailed();
                continue;
            }

            if (!seenGuids.TryAdd(guid, 0))
            {
                continue;
            }

            onFetched();
            if (jsonlPath is not null)
            {
                await AppendJsonlAsync(jsonlPath, row).ConfigureAwait(false);
            }

            await rows.WriteAsync(row, ct).ConfigureAwait(false);
        }
    }

    private static readonly object JsonlLock = new();

    private static Task AppendJsonlAsync(string path, ProductRow row)
    {
        var line = JsonSerializer.Serialize(row) + "\n";
        lock (JsonlLock)
        {
            File.AppendAllText(path, line, Encoding.UTF8);
        }
        return Task.CompletedTask;
    }

    private static async Task SqlWriterAsync(
        string connectionString,
        ChannelReader<ProductRow> rows,
        Action<int> onUpserted,
        CancellationToken ct)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct).ConfigureAwait(false);
        Console.WriteLine("SQL writer connected.");

        var batch = new List<ProductRow>(SqlBatchSize);

        async Task FlushAsync()
        {
            if (batch.Count == 0)
            {
                return;
            }

            var n = batch.Count;
            try
            {
                await UpsertBatchAsync(conn, batch).ConfigureAwait(false);
                onUpserted(n);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"sql batch failed n={n}: {ex.Message}");
                throw;
            }
            finally
            {
                batch.Clear();
            }
        }

        while (!ct.IsCancellationRequested)
        {
            using var delayCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            delayCts.CancelAfter(TimeSpan.FromSeconds(2));

            try
            {
                while (batch.Count < SqlBatchSize)
                {
                    if (!await rows.WaitToReadAsync(delayCts.Token).ConfigureAwait(false))
                    {
                        await FlushAsync().ConfigureAwait(false);
                        return;
                    }

                    while (batch.Count < SqlBatchSize && rows.TryRead(out var row))
                    {
                        batch.Add(row);
                    }
                }

                await FlushAsync().ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                // Flush whatever we have every ~2s so HTTP stalls don't block SQL forever.
                await FlushAsync().ConfigureAwait(false);
            }
        }
    }

    private static async Task UpsertBatchAsync(SqlConnection conn, List<ProductRow> rows)
    {
        // Dedupe by barcode within batch (last wins).
        var map = new Dictionary<string, ProductRow>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            map[row.Barcode] = row;
        }

        var table = new DataTable();
        table.Columns.Add("dest", typeof(string));
        table.Columns.Add("barcode", typeof(string));
        table.Columns.Add("name", typeof(string));
        table.Columns.Add("ingredients", typeof(string));
        foreach (var row in map.Values)
        {
            table.Rows.Add(row.Table, row.Barcode, row.Name, (object?)row.Ingredients ?? DBNull.Value);
        }

        var sw = System.Diagnostics.Stopwatch.StartNew();

        await using (var create = conn.CreateCommand())
        {
            create.CommandTimeout = 60;
            create.CommandText = """
                IF OBJECT_ID('tempdb..#src') IS NOT NULL DROP TABLE #src;
                CREATE TABLE #src (
                  dest NVARCHAR(16) NOT NULL,
                  barcode NVARCHAR(64) NOT NULL PRIMARY KEY,
                  name NVARCHAR(512) NOT NULL,
                  ingredients NVARCHAR(MAX) NULL
                );
                """;
            await create.ExecuteNonQueryAsync().ConfigureAwait(false);
        }

        using (var bulk = new SqlBulkCopy(conn))
        {
            bulk.DestinationTableName = "#src";
            bulk.BulkCopyTimeout = 60;
            bulk.ColumnMappings.Add("dest", "dest");
            bulk.ColumnMappings.Add("barcode", "barcode");
            bulk.ColumnMappings.Add("name", "name");
            bulk.ColumnMappings.Add("ingredients", "ingredients");
            await bulk.WriteToServerAsync(table).ConfigureAwait(false);
        }

        await using (var merge = conn.CreateCommand())
        {
            merge.CommandTimeout = 120;
            merge.CommandText = """
                DELETE f
                FROM dbo.glutenfri f
                INNER JOIN #src s ON s.barcode = f.barcode AND s.dest = N'gluten'
                WHERE f.barcode <> N'unknown';

                DELETE g
                FROM dbo.gluten g
                INNER JOIN #src s ON s.barcode = g.barcode AND s.dest = N'glutenfri'
                WHERE g.barcode <> N'unknown';

                UPDATE f
                SET f.name = s.name,
                    f.ingredients = s.ingredients
                FROM dbo.glutenfri f
                INNER JOIN #src s ON s.barcode = f.barcode AND s.dest = N'glutenfri';

                INSERT INTO dbo.glutenfri(barcode, name, ingredients)
                SELECT s.barcode, s.name, s.ingredients
                FROM #src s
                WHERE s.dest = N'glutenfri'
                  AND NOT EXISTS (SELECT 1 FROM dbo.glutenfri f WHERE f.barcode = s.barcode);

                UPDATE g
                SET g.name = s.name,
                    g.ingredients = s.ingredients
                FROM dbo.gluten g
                INNER JOIN #src s ON s.barcode = g.barcode AND s.dest = N'gluten';

                INSERT INTO dbo.gluten(barcode, name, ingredients)
                SELECT s.barcode, s.name, s.ingredients
                FROM #src s
                WHERE s.dest = N'gluten'
                  AND NOT EXISTS (SELECT 1 FROM dbo.gluten g WHERE g.barcode = s.barcode);
                """;
            await merge.ExecuteNonQueryAsync().ConfigureAwait(false);
        }

        if (sw.ElapsedMilliseconds > 2000)
        {
            Console.WriteLine($"sql batch n={map.Count} took {sw.ElapsedMilliseconds}ms");
        }
    }

    private static ProductRow? Normalize(ProductDetail? detail)
    {
        if (detail?.Pakninger is null || detail.Pakninger.Count == 0)
        {
            return null;
        }

        var pakning = detail.Pakninger.FirstOrDefault(p => p.IsBasispakning == true && HasGtin(p))
                      ?? detail.Pakninger.FirstOrDefault(HasGtin);
        if (pakning is null)
        {
            return null;
        }

        var barcode = ReadGtin(pakning);
        if (string.IsNullOrWhiteSpace(barcode) || barcode.Equals("unknown", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var name = (pakning.Markedsnavn ?? detail.FellesProduktnavn ?? $"GTIN {barcode}").Trim();
        if (name.Length > 512)
        {
            name = name[..512];
        }

        var ingredients = string.IsNullOrWhiteSpace(pakning.Ingredienser)
            ? null
            : pakning.Ingredienser.Trim();

        var table = Classify(pakning);
        return new ProductRow(
            table,
            barcode,
            name,
            ingredients,
            detail.VariantIdentityGuid);
    }

    private static string Classify(Pakning pakning)
    {
        static bool IsGluten(string? value) =>
            !string.IsNullOrWhiteSpace(value)
            && value.Contains("gluten", StringComparison.OrdinalIgnoreCase);

        var contains = pakning.AllergenerInneholder ?? [];
        var may = pakning.AllergenerKanInneholde ?? [];
        return contains.Concat(may).Any(IsGluten) ? "gluten" : "glutenfri";
    }

    private static bool HasGtin(Pakning p) => !string.IsNullOrWhiteSpace(ReadGtin(p));

    private static string? ReadGtin(Pakning p)
    {
        if (p.Gtin is null || p.Gtin.Value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        return p.Gtin.Value.ValueKind switch
        {
            JsonValueKind.String => p.Gtin.Value.GetString()?.Trim(),
            JsonValueKind.Number => p.Gtin.Value.GetRawText().Trim(),
            _ => p.Gtin.Value.ToString()?.Trim(),
        };
    }
}

internal sealed record ProductRow(
    [property: JsonPropertyName("table")] string Table,
    [property: JsonPropertyName("barcode")] string Barcode,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("ingredients")] string? Ingredients,
    [property: JsonPropertyName("variantIdentityGuid")] string? VariantIdentityGuid);

internal sealed class SearchResponse
{
    public List<SearchProduct> Products { get; set; } = [];
}

internal sealed class SearchProduct
{
    public string? VariantIdentityGuid { get; set; }
}

internal sealed class ProductDetail
{
    public string? FellesProduktnavn { get; set; }
    public string? VariantIdentityGuid { get; set; }
    public List<Pakning>? Pakninger { get; set; }
}

internal sealed class Pakning
{
    public JsonElement? Gtin { get; set; }
    public string? Markedsnavn { get; set; }
    public string? Ingredienser { get; set; }
    public bool? IsBasispakning { get; set; }
    public List<string>? AllergenerInneholder { get; set; }
    public List<string>? AllergenerKanInneholde { get; set; }
}
