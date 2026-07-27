using System.Text.Json;
using GlutenScanner.Api.Config;
using GlutenScanner.Api.Data;
using GlutenScanner.Api.Models;
using GlutenScanner.Api.Security;
using GlutenScanner.Api.Services;
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Missing connection string 'ConnectionStrings:Default'. Provide your Azure SQL " +
        "connection string via user-secrets, the ConnectionStrings__Default environment " +
        "variable, or appsettings.Development.json. See backend/README.md.");
}
// Catalog defaults to the same DB (GlutenFridb) unless overridden.
var catalogConnectionString =
    builder.Configuration.GetConnectionString("GlutenFriCatalog")
    ?? connectionString;
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddDbContext<MenyCatalogDbContext>(options => options.UseSqlServer(catalogConnectionString));
builder.Services.AddSingleton(_ =>
    LevelProgressTable.LoadFromContentRoot(builder.Environment.ContentRootPath));
builder.Services.AddSingleton<LeaderboardBuffer>();
builder.Services.AddSingleton<ProfileRefreshLimiter>();
builder.Services.AddSingleton<ListsRefreshLimiter>();
builder.Services.AddHostedService<LeaderboardRefreshHostedService>();
const string DevCorsPolicy = "DevCors";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevCorsPolicy, policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});
var app = builder.Build();
app.UseCors(DevCorsPolicy);
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DbInitializer.InitializeAsync(db);
    var catalog = scope.ServiceProvider.GetRequiredService<MenyCatalogDbContext>();
    await EnsureCatalogSchemaAsync(catalog);
    await DbInitializer.EnsureXpProgressTableAsync(db);
}
app.MapGet("/", () => Results.Ok(new { service = "UtenGluten.Api", status = "ok" }));
app.MapGet("/api/levels", (LevelProgressTable levels) =>
    Results.Ok(new { levels = levels.Levels }));
app.MapGet("/api/leaderboard", async (
    HttpContext ctx,
    AppDbContext db,
    LeaderboardBuffer leaderboard) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    return Results.Ok(leaderboard.GetSnapshotForViewer(user.Id));
});
var auth = app.MapGroup("/api/auth");
auth.MapPost("/register", async (RegisterRequest request, AppDbContext db) =>
{
    var username = request.Username?.Trim();
    var password = request.Password ?? string.Empty;
    if (string.IsNullOrEmpty(username) || username.Length < 3)
    {
        return Results.BadRequest(new { error = "Username must be at least 3 characters." });
    }
    if (password.Length < 6)
    {
        return Results.BadRequest(new { error = "Password must be at least 6 characters." });
    }
    var exists = await db.Users.AnyAsync(u => u.Username == username);
    if (exists)
    {
        return Results.Conflict(new { error = "That username is already taken." });
    }
    var now = DateTime.UtcNow;
    var user = new User
    {
        Username = username,
        PasswordHash = PasswordHasher.Hash(password),
        Level = 1,
        Xp = 1,
        PublicUser = false,
        CreatedAt = now,
        UpdatedAt = now,
    };
    db.Users.Add(user);
    await db.SaveChangesAsync();
    var authResult = await CreateSessionAsync(db, user);
    return Results.Created("/api/auth/me", authResult);
});
auth.MapPost("/login", async (LoginRequest request, AppDbContext db) =>
{
    var username = request.Username?.Trim();
    var password = request.Password ?? string.Empty;
    if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
    {
        return Results.BadRequest(new { error = "Username and password are required." });
    }
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user is null || !PasswordHasher.Verify(password, user.PasswordHash))
    {
        return Results.Json(new { error = "Invalid username or password." }, statusCode: StatusCodes.Status401Unauthorized);
    }
    var authResult = await CreateSessionAsync(db, user);
    return Results.Ok(authResult);
});
auth.MapPost("/logout", async (HttpContext ctx, AppDbContext db) =>
{
    var token = AuthHelper.ExtractToken(ctx);
    if (!string.IsNullOrEmpty(token))
    {
        await db.Sessions.Where(s => s.Token == token).ExecuteDeleteAsync();
    }
    return Results.NoContent();
});
auth.MapGet("/me", async (HttpContext ctx, AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    return user is null ? Results.Unauthorized() : Results.Ok(ToUserResponse(user));
});
auth.MapPut("/public-user", async (
    SetPublicUserRequest request,
    HttpContext ctx,
    AppDbContext db,
    LeaderboardBuffer leaderboard) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    if (request.PublicUser is null)
    {
        return Results.BadRequest(new { error = "publicUser (true/false) is required." });
    }

    // Only the authenticated session user can change this row.
    var tracked = await db.Users.FirstOrDefaultAsync(u => u.Id == user.Id);
    if (tracked is null)
    {
        return Results.Unauthorized();
    }

    tracked.PublicUser = request.PublicUser.Value;
    tracked.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();

    // Patch only this user's board rows (if present); no full rebuild.
    leaderboard.ApplyPrivacyChange(tracked.Id, tracked.PublicUser, tracked.Username);

    return Results.Ok(ToUserResponse(tracked));
});
auth.MapPut("/profile-image", async (
    SetProfileImageRequest request,
    HttpContext ctx,
    AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var tracked = await db.Users.FirstOrDefaultAsync(u => u.Id == user.Id);
    if (tracked is null)
    {
        return Results.Unauthorized();
    }

    if (request.ImageBase64 is null)
    {
        return Results.BadRequest(new { error = "imageBase64 is required (or send empty string to clear)." });
    }

    if (string.IsNullOrWhiteSpace(request.ImageBase64))
    {
        tracked.ProfileImageBase64 = null;
    }
    else if (!TryNormalizeImageBase64(request.ImageBase64, out var normalized, out var imageError))
    {
        return Results.BadRequest(new { error = imageError });
    }
    else
    {
        tracked.ProfileImageBase64 = normalized;
    }

    tracked.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(ToUserResponse(tracked));
});
auth.MapPut("/favorites", async (
    SetFavoritesRequest request,
    HttpContext ctx,
    AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    if (request.Favorites is null)
    {
        return Results.BadRequest(new { error = "favorites array is required." });
    }

    var tracked = await db.Users.FirstOrDefaultAsync(u => u.Id == user.Id);
    if (tracked is null)
    {
        return Results.Unauthorized();
    }

    if (!TryNormalizeFavorites(request.Favorites, out var normalized, out var favError))
    {
        return Results.BadRequest(new { error = favError });
    }

    tracked.FavoritesJson = SerializeFavorites(normalized);
    tracked.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(ToUserResponse(tracked));
});
auth.MapPost("/favorites", async (
    FavoriteProductRef request,
    HttpContext ctx,
    AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    if (!TryNormalizeFavorite(request, out var item, out var favError))
    {
        return Results.BadRequest(new { error = favError });
    }

    var tracked = await db.Users.FirstOrDefaultAsync(u => u.Id == user.Id);
    if (tracked is null)
    {
        return Results.Unauthorized();
    }

    var list = ParseFavorites(tracked.FavoritesJson).ToList();
    if (!list.Any(f => f.Catalog == item.Catalog && f.Id == item.Id))
    {
        list.Add(item);
        tracked.FavoritesJson = SerializeFavorites(list);
        tracked.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    return Results.Ok(ToUserResponse(tracked));
});
auth.MapDelete("/favorites", async (
    string catalog,
    int id,
    HttpContext ctx,
    AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    if (!TryNormalizeFavorite(new FavoriteProductRef(catalog, id), out var item, out var favError))
    {
        return Results.BadRequest(new { error = favError });
    }

    var tracked = await db.Users.FirstOrDefaultAsync(u => u.Id == user.Id);
    if (tracked is null)
    {
        return Results.Unauthorized();
    }

    var list = ParseFavorites(tracked.FavoritesJson)
        .Where(f => !(f.Catalog == item.Catalog && f.Id == item.Id))
        .ToList();
    tracked.FavoritesJson = SerializeFavorites(list);
    tracked.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(ToUserResponse(tracked));
});
auth.MapGet("/xp", async (
    HttpContext ctx,
    AppDbContext db,
    MenyCatalogDbContext catalog,
    LevelProgressTable levelProgress,
    ProfileRefreshLimiter refreshLimiter,
    ILoggerFactory loggerFactory) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Unauthorized();
    }

    if (!refreshLimiter.TryAcquire(user.Id, out var retryAfterSeconds))
    {
        loggerFactory.CreateLogger("ProfileRefresh").LogInformation(
            "Rate-limited XP refresh for user {UserId}; retry in {RetryAfterSeconds}s",
            user.Id,
            retryAfterSeconds);
        ctx.Response.Headers.RetryAfter = retryAfterSeconds.ToString();
        return Results.Json(
            new
            {
                error = "Too many refresh requests.",
                retryAfterSeconds,
            },
            statusCode: StatusCodes.Status429TooManyRequests);
    }

    var entry = levelProgress.GetEntryForXp(user.Xp);
    var span = Math.Max(1, entry.MaxXp - entry.MinXp);
    var into = Math.Clamp(user.Xp - entry.MinXp, 0, span);
    var toNext = Math.Max(0, entry.MaxXp - user.Xp);
    var progress = Math.Clamp(into / (double)span, 0, 1);
    // Cap display span for level 99 so the bar isn't empty against maxXp=1_000_000.
    var displaySpan = entry.Level >= 99 ? Math.Max(into, 1) : span;
    var displayInto = entry.Level >= 99 ? displaySpan : into;
    var displayToNext = entry.Level >= 99 ? 0 : toNext;
    var displayProgress = entry.Level >= 99 ? 1.0 : progress;

    var rows = await db.XpProgress
        .AsNoTracking()
        .Where(x => x.UserId == user.Id)
        .OrderByDescending(x => x.CreatedAt)
        .ThenByDescending(x => x.Id)
        .Take(100)
        .ToListAsync();

    var reportIds = rows
        .Where(r => r.BarcodeReportId is not null)
        .Select(r => r.BarcodeReportId!.Value)
        .Distinct()
        .ToList();
    var submissionIds = rows
        .Where(r => r.ProductSubmissionId is not null)
        .Select(r => r.ProductSubmissionId!.Value)
        .Distinct()
        .ToList();

    var reportNames = reportIds.Count == 0
        ? new Dictionary<int, string>()
        : await catalog.BarcodeReports
            .AsNoTracking()
            .Where(r => reportIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.Id, r => r.ProductName);

    var submissionNames = submissionIds.Count == 0
        ? new Dictionary<int, string>()
        : await db.ProductSubmissions
            .AsNoTracking()
            .Where(s => submissionIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Name);

    var history = rows.Select(r =>
    {
        string reason;
        string? detail = null;
        if (r.BarcodeReportId is int reportId)
        {
            reason = "barcode_report";
            reportNames.TryGetValue(reportId, out detail);
        }
        else if (r.ProductSubmissionId is int submissionId)
        {
            reason = "product_submission";
            submissionNames.TryGetValue(submissionId, out detail);
        }
        else
        {
            reason = "other";
        }

        return new XpHistoryItemResponse(r.Id, r.XpAmount, r.CreatedAt, reason, detail);
    }).ToList();

    return Results.Ok(new XpProfileResponse(
        user.Xp,
        user.Level,
        entry.Level,
        user.IsAdmin,
        entry.MinXp,
        entry.Level >= 99 ? user.Xp : entry.MaxXp,
        displayInto,
        displaySpan,
        displayToNext,
        displayProgress,
        history));
});

var lists = app.MapGroup("/api/lists");
lists.MapGet("/", async (
    string? scope,
    HttpContext ctx,
    AppDbContext db,
    ListsRefreshLimiter refreshLimiter,
    ILoggerFactory loggerFactory) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    if (!refreshLimiter.TryAcquire(user.Id, scope ?? "mine", out var retryAfterSeconds))
    {
        loggerFactory.CreateLogger("ListsRefresh").LogInformation(
            "Rate-limited lists refresh for user {UserId} scope {Scope}; retry in {RetryAfterSeconds}s",
            user.Id,
            scope ?? "mine",
            retryAfterSeconds);
        ctx.Response.Headers.RetryAfter = retryAfterSeconds.ToString();
        return Results.Json(
            new
            {
                error = "Too many list refresh requests.",
                retryAfterSeconds,
            },
            statusCode: StatusCodes.Status429TooManyRequests);
    }

    var wantShared = string.Equals(scope, "shared", StringComparison.OrdinalIgnoreCase);
    List<ProductList> rows;
    if (wantShared)
    {
        var all = await db.Lists.AsNoTracking().Include(l => l.Owner).ToListAsync();
        rows = all
            .Where(l => ParseSharedUserIds(l.SharedUserIdsJson).Contains(user.Id))
            .OrderByDescending(l => l.CreatedAt)
            .ThenByDescending(l => l.Id)
            .ToList();
    }
    else
    {
        rows = await db.Lists.AsNoTracking()
            .Include(l => l.Owner)
            .Where(l => l.OwnerId == user.Id)
            .OrderByDescending(l => l.CreatedAt)
            .ThenByDescending(l => l.Id)
            .ToListAsync();
    }

    var responses = new List<ProductListResponse>(rows.Count);
    foreach (var row in rows)
    {
        responses.Add(await ToProductListResponseAsync(row, user, db));
    }

    return Results.Ok(responses);
});
lists.MapGet("/{id:int}", async (int id, HttpContext ctx, AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var row = await db.Lists.AsNoTracking().Include(l => l.Owner).FirstOrDefaultAsync(l => l.Id == id);
    if (row is null)
    {
        return Results.NotFound(new { error = "List not found." });
    }

    if (!CanAccessList(row, user.Id))
    {
        return Results.Json(new { error = "You do not have access to this list." }, statusCode: StatusCodes.Status403Forbidden);
    }

    return Results.Ok(await ToProductListResponseAsync(row, user, db));
});
lists.MapPost("/", async (CreateProductListRequest request, HttpContext ctx, AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var name = (request.Name ?? string.Empty).Trim();
    if (name.Length < 1)
    {
        return Results.BadRequest(new { error = "List name is required." });
    }

    if (name.Length > 128)
    {
        return Results.BadRequest(new { error = "List name must be at most 128 characters." });
    }

    var row = new ProductList
    {
        OwnerId = user.Id,
        Name = name,
        SharedUserIdsJson = "[]",
        ProductIdsJson = "[]",
        CreatedAt = DateTime.UtcNow,
    };
    db.Lists.Add(row);
    await db.SaveChangesAsync();
    row.Owner = user;
    return Results.Ok(await ToProductListResponseAsync(row, user, db));
});
lists.MapDelete("/{id:int}", async (int id, HttpContext ctx, AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var row = await db.Lists.FirstOrDefaultAsync(l => l.Id == id);
    if (row is null)
    {
        return Results.NotFound(new { error = "List not found." });
    }

    if (row.OwnerId != user.Id)
    {
        return Results.Json(new { error = "Only the owner can delete this list." }, statusCode: StatusCodes.Status403Forbidden);
    }

    db.Lists.Remove(row);
    await db.SaveChangesAsync();
    return Results.Ok(new { ok = true });
});
lists.MapPost("/{id:int}/products", async (
    int id,
    FavoriteProductRef request,
    HttpContext ctx,
    AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    if (!TryNormalizeFavorite(request, out var item, out var favError))
    {
        return Results.BadRequest(new { error = favError });
    }

    var row = await db.Lists.Include(l => l.Owner).FirstOrDefaultAsync(l => l.Id == id);
    if (row is null)
    {
        return Results.NotFound(new { error = "List not found." });
    }

    if (!CanAccessList(row, user.Id))
    {
        return Results.Json(new { error = "You do not have access to this list." }, statusCode: StatusCodes.Status403Forbidden);
    }

    var products = ParseFavorites(row.ProductIdsJson).ToList();
    if (!products.Any(p => p.Catalog == item.Catalog && p.Id == item.Id))
    {
        products.Add(item);
        row.ProductIdsJson = SerializeFavorites(products);
        await db.SaveChangesAsync();
    }

    return Results.Ok(await ToProductListResponseAsync(row, user, db));
});
lists.MapDelete("/{listId:int}/products", async (
    int listId,
    string catalog,
    int id,
    HttpContext ctx,
    AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    if (!TryNormalizeFavorite(new FavoriteProductRef(catalog, id), out var item, out var favError))
    {
        return Results.BadRequest(new { error = favError });
    }

    var row = await db.Lists.Include(l => l.Owner).FirstOrDefaultAsync(l => l.Id == listId);
    if (row is null)
    {
        return Results.NotFound(new { error = "List not found." });
    }

    if (!CanAccessList(row, user.Id))
    {
        return Results.Json(new { error = "You do not have access to this list." }, statusCode: StatusCodes.Status403Forbidden);
    }

    var products = ParseFavorites(row.ProductIdsJson)
        .Where(p => !(p.Catalog == item.Catalog && p.Id == item.Id))
        .ToList();
    row.ProductIdsJson = SerializeFavorites(products);
    await db.SaveChangesAsync();
    return Results.Ok(await ToProductListResponseAsync(row, user, db));
});
lists.MapPost("/{id:int}/share", async (
    int id,
    ShareProductListRequest request,
    HttpContext ctx,
    AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var username = (request.Username ?? string.Empty).Trim();
    if (username.Length < 1)
    {
        return Results.BadRequest(new { error = "Username is required." });
    }

    var row = await db.Lists.Include(l => l.Owner).FirstOrDefaultAsync(l => l.Id == id);
    if (row is null)
    {
        return Results.NotFound(new { error = "List not found." });
    }

    if (row.OwnerId != user.Id)
    {
        return Results.Json(new { error = "Only the owner can share this list." }, statusCode: StatusCodes.Status403Forbidden);
    }

    var target = await db.Users.AsNoTracking()
        .FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
    if (target is null)
    {
        return Results.NotFound(new { error = "User not found." });
    }

    if (target.Id == user.Id)
    {
        return Results.BadRequest(new { error = "You already own this list." });
    }

    var shared = ParseSharedUserIds(row.SharedUserIdsJson).ToList();
    if (!shared.Contains(target.Id))
    {
        shared.Add(target.Id);
        row.SharedUserIdsJson = SerializeSharedUserIds(shared);
        await db.SaveChangesAsync();
    }

    return Results.Ok(await ToProductListResponseAsync(row, user, db));
});
lists.MapDelete("/{id:int}/share", async (
    int id,
    string username,
    HttpContext ctx,
    AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var row = await db.Lists.Include(l => l.Owner).FirstOrDefaultAsync(l => l.Id == id);
    if (row is null)
    {
        return Results.NotFound(new { error = "List not found." });
    }

    if (row.OwnerId != user.Id)
    {
        return Results.Json(new { error = "Only the owner can manage sharing." }, statusCode: StatusCodes.Status403Forbidden);
    }

    var target = await db.Users.AsNoTracking()
        .FirstOrDefaultAsync(u => u.Username.ToLower() == username.Trim().ToLower());
    if (target is null)
    {
        return Results.NotFound(new { error = "User not found." });
    }

    var shared = ParseSharedUserIds(row.SharedUserIdsJson)
        .Where(uid => uid != target.Id)
        .ToList();
    row.SharedUserIdsJson = SerializeSharedUserIds(shared);
    await db.SaveChangesAsync();
    return Results.Ok(await ToProductListResponseAsync(row, user, db));
});

var products = app.MapGroup("/api/products");
products.MapGet("/search", async (string? q, int? limit, bool? unknownOnly, MenyCatalogDbContext catalog) =>
{
    var term = (q ?? string.Empty).Trim();
    if (term.Length < 5)
    {
        return Results.BadRequest(new { error = "Search query must be at least 5 characters." });
    }
    var take = Math.Clamp(limit ?? 40, 1, 100);
    var pattern = $"%{EscapeLike(term)}%";
    var onlyUnknown = unknownOnly == true;
    var unknown = MenyCatalogDbContext.UnknownBarcode;

    var friQuery = catalog.GlutenFriProducts.Where(p => EF.Functions.Like(p.Name, pattern));
    var glutenQuery = catalog.GlutenProducts.Where(p => EF.Functions.Like(p.Name, pattern));
    if (onlyUnknown)
    {
        friQuery = friQuery.Where(p => p.Barcode == unknown);
        glutenQuery = glutenQuery.Where(p => p.Barcode == unknown);
    }

    var fri = await friQuery.OrderBy(p => p.Name).Take(take).ToListAsync();
    var gluten = await glutenQuery.OrderBy(p => p.Name).Take(take).ToListAsync();
    var merged = fri
        .Select(p => ToCatalogResponse(
            p.Id, p.Barcode, p.Name, GlutenRatings.GlutenFree, p.CreatedAt, MenyCatalogDbContext.CatalogFri,
            p.ImageBase64, ingredients: p.Ingredients, produsent: p.Produsent))
        .Concat(gluten.Select(p => ToCatalogResponse(
            p.Id, p.Barcode, p.Name, GlutenRatings.GlutenContent, p.CreatedAt, MenyCatalogDbContext.CatalogGluten,
            p.ImageBase64, ingredients: p.Ingredients, produsent: p.Produsent)))
        .OrderBy(p => p.Name, StringComparer.CurrentCultureIgnoreCase)
        .Take(take)
        .ToList();
    return Results.Ok(merged);
});
products.MapGet("/{catalog}/{id:int}", async (string catalog, int id, MenyCatalogDbContext dbCatalog) =>
{
    var key = catalog.Trim().ToLowerInvariant();
    if (key is MenyCatalogDbContext.CatalogFri or "fri")
    {
        var fri = await dbCatalog.GlutenFriProducts.FirstOrDefaultAsync(p => p.Id == id);
        return fri is null
            ? Results.NotFound()
            : Results.Ok(ToCatalogResponse(
                fri.Id, fri.Barcode, fri.Name, GlutenRatings.GlutenFree, fri.CreatedAt, MenyCatalogDbContext.CatalogFri,
                fri.ImageBase64, ingredients: fri.Ingredients, produsent: fri.Produsent));
    }
    if (key is MenyCatalogDbContext.CatalogGluten or "glutenholdig")
    {
        var gluten = await dbCatalog.GlutenProducts.FirstOrDefaultAsync(p => p.Id == id);
        return gluten is null
            ? Results.NotFound()
            : Results.Ok(ToCatalogResponse(
                gluten.Id, gluten.Barcode, gluten.Name, GlutenRatings.GlutenContent, gluten.CreatedAt, MenyCatalogDbContext.CatalogGluten,
                gluten.ImageBase64, ingredients: gluten.Ingredients, produsent: gluten.Produsent));
    }
    return Results.BadRequest(new { error = "catalog must be glutenfri or gluten." });
});
products.MapGet("/{barcode}", async (string barcode, MenyCatalogDbContext catalog) =>
{
    var trimmed = barcode.Trim();
    if (string.Equals(trimmed, MenyCatalogDbContext.UnknownBarcode, StringComparison.OrdinalIgnoreCase)
        || trimmed.Contains('/'))
    {
        return Results.NotFound();
    }
    var fri = await catalog.GlutenFriProducts.FirstOrDefaultAsync(p => p.Barcode == trimmed);
    if (fri is not null)
    {
        return Results.Ok(ToCatalogResponse(
            fri.Id, fri.Barcode, fri.Name, GlutenRatings.GlutenFree, fri.CreatedAt, MenyCatalogDbContext.CatalogFri,
            fri.ImageBase64, ingredients: fri.Ingredients, produsent: fri.Produsent));
    }
    var gluten = await catalog.GlutenProducts.FirstOrDefaultAsync(p => p.Barcode == trimmed);
    if (gluten is not null)
    {
        return Results.Ok(ToCatalogResponse(
            gluten.Id, gluten.Barcode, gluten.Name, GlutenRatings.GlutenContent, gluten.CreatedAt, MenyCatalogDbContext.CatalogGluten,
            gluten.ImageBase64, ingredients: gluten.Ingredients, produsent: gluten.Produsent));
    }
    return Results.NotFound();
});
products.MapPost("/{catalog}/{id:int}/report-barcode", async (
    string catalog,
    int id,
    ReportBarcodeRequest request,
    HttpContext ctx,
    AppDbContext appDb,
    MenyCatalogDbContext catalogDb,
    LevelProgressTable levelProgress) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, appDb);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in to report a barcode." }, statusCode: StatusCodes.Status401Unauthorized);
    }
    var suggested = request.Barcode?.Trim() ?? string.Empty;
    if (string.IsNullOrEmpty(suggested) || suggested.Length < 4)
    {
        return Results.BadRequest(new { error = "Barcode must be at least 4 characters." });
    }
    if (string.Equals(suggested, MenyCatalogDbContext.UnknownBarcode, StringComparison.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new { error = "Suggested barcode cannot be unknown." });
    }
    var key = catalog.Trim().ToLowerInvariant();
    if (key is "fri") key = MenyCatalogDbContext.CatalogFri;
    if (key is "glutenholdig") key = MenyCatalogDbContext.CatalogGluten;
    string productName;
    string currentBarcode;
    string? imageBase64 = null;
    if (key == MenyCatalogDbContext.CatalogFri)
    {
        var fri = await catalogDb.GlutenFriProducts.FirstOrDefaultAsync(p => p.Id == id);
        if (fri is null) return Results.NotFound(new { error = "Product not found." });
        productName = fri.Name;
        currentBarcode = fri.Barcode;
        imageBase64 = fri.ImageBase64;
    }
    else if (key == MenyCatalogDbContext.CatalogGluten)
    {
        var gluten = await catalogDb.GlutenProducts.FirstOrDefaultAsync(p => p.Id == id);
        if (gluten is null) return Results.NotFound(new { error = "Product not found." });
        productName = gluten.Name;
        currentBarcode = gluten.Barcode;
        imageBase64 = gluten.ImageBase64;
    }
    else
    {
        return Results.BadRequest(new { error = "catalog must be glutenfri or gluten." });
    }
    if (!string.Equals(currentBarcode, MenyCatalogDbContext.UnknownBarcode, StringComparison.OrdinalIgnoreCase))
    {
        return Results.Conflict(new { error = "This product already has a barcode." });
    }
    var takenFri = await catalogDb.GlutenFriProducts.AnyAsync(p => p.Barcode == suggested);
    var takenGluten = await catalogDb.GlutenProducts.AnyAsync(p => p.Barcode == suggested);
    if (takenFri || takenGluten)
    {
        return Results.Conflict(new { error = "That barcode is already linked to another product." });
    }

    // Admins apply immediately. Non-admins are pending unless matching reporters'
    // combined privilege levels reach the crowd-approve threshold (>= 100).
    var applyNow = user.IsAdmin;
    var reportImage = string.IsNullOrWhiteSpace(request.ImageBase64) ? null : request.ImageBase64.Trim();
    // Non-admins may not replace an existing catalog product photo.
    if (!user.IsAdmin && !string.IsNullOrWhiteSpace(imageBase64))
    {
        reportImage = null;
    }
    if (reportImage is not null && !TryNormalizeImageBase64(reportImage, out reportImage, out var imageError))
    {
        return Results.BadRequest(new { error = imageError });
    }

    // Non-admin photos go to product_image_validations; they never auto-apply
    // when a barcode report is crowd-approved.
    string? adminApplyImage = null;
    var imageQueuedForValidation = false;
    if (reportImage is not null)
    {
        if (user.IsAdmin)
        {
            adminApplyImage = reportImage;
        }
        else
        {
            await QueueOrUpdateProductImageValidationAsync(
                appDb, key, id, productName, reportImage, user.Id);
            imageQueuedForValidation = true;
            reportImage = null;
        }
    }

    var existingSameReport = await catalogDb.BarcodeReports
        .Where(r =>
            r.Catalog == key &&
            r.ProductId == id &&
            r.SuggestedBarcode == suggested &&
            r.ReportedByUserId == user.Id)
        .OrderByDescending(r => r.Id)
        .FirstOrDefaultAsync();

    BarcodeReport reportEntity;
    if (existingSameReport is not null)
    {
        // Same user reporting the same link again: refresh image if admin provided one.
        if (adminApplyImage is not null)
        {
            existingSameReport.ImageBase64 = adminApplyImage;
        }
        reportEntity = existingSameReport;
    }
    else
    {
        reportEntity = new BarcodeReport
        {
            Catalog = key,
            ProductId = id,
            ProductName = productName,
            SuggestedBarcode = suggested,
            ImageBase64 = adminApplyImage,
            ReportedByUserId = user.Id,
            Applied = false,
            CreatedAt = DateTime.UtcNow,
        };
        catalogDb.BarcodeReports.Add(reportEntity);
    }

    if (!applyNow)
    {
        // Persist the report first so it is included in the crowd tally.
        await catalogDb.SaveChangesAsync();
        if (imageQueuedForValidation)
        {
            await appDb.SaveChangesAsync();
        }

        var matchingReports = await catalogDb.BarcodeReports
            .Where(r =>
                r.Catalog == key &&
                r.ProductId == id &&
                r.SuggestedBarcode == suggested)
            .ToListAsync();

        var reporterIds = matchingReports
            .Where(r => r.ReportedByUserId is not null)
            .Select(r => r.ReportedByUserId!.Value)
            .Distinct()
            .ToList();

        var levels = reporterIds.Count == 0
            ? new List<int>()
            : await appDb.Users
                .Where(u => reporterIds.Contains(u.Id))
                .Select(u => u.Level)
                .ToListAsync();

        var cumulativeLevel = levels.Sum();
        if (cumulativeLevel >= User.AdminLevel)
        {
            applyNow = true;

            if (key == MenyCatalogDbContext.CatalogFri)
            {
                var fri = await catalogDb.GlutenFriProducts.FirstAsync(p => p.Id == id);
                fri.Barcode = suggested;
                imageBase64 = fri.ImageBase64;
            }
            else
            {
                var gluten = await catalogDb.GlutenProducts.FirstAsync(p => p.Id == id);
                gluten.Barcode = suggested;
                imageBase64 = gluten.ImageBase64;
            }

            foreach (var match in matchingReports)
            {
                match.Applied = true;
            }

            await catalogDb.SaveChangesAsync();
            await XpRewardService.AwardForAppliedBarcodeReportsAsync(
                appDb, levelProgress, matchingReports);
        }
    }
    else
    {
        if (key == MenyCatalogDbContext.CatalogFri)
        {
            var fri = await catalogDb.GlutenFriProducts.FirstAsync(p => p.Id == id);
            fri.Barcode = suggested;
            if (adminApplyImage is not null && string.IsNullOrWhiteSpace(fri.ImageBase64))
            {
                fri.ImageBase64 = adminApplyImage;
            }
            imageBase64 = fri.ImageBase64;
        }
        else
        {
            var gluten = await catalogDb.GlutenProducts.FirstAsync(p => p.Id == id);
            gluten.Barcode = suggested;
            if (adminApplyImage is not null && string.IsNullOrWhiteSpace(gluten.ImageBase64))
            {
                gluten.ImageBase64 = adminApplyImage;
            }
            imageBase64 = gluten.ImageBase64;
        }

        reportEntity.Applied = true;

        // Mark any prior matching pending reports as applied too.
        var priorMatches = await catalogDb.BarcodeReports
            .Where(r =>
                r.Catalog == key &&
                r.ProductId == id &&
                r.SuggestedBarcode == suggested &&
                !r.Applied)
            .ToListAsync();
        foreach (var match in priorMatches)
        {
            match.Applied = true;
        }

        await catalogDb.SaveChangesAsync();

        var rewarded = new List<BarcodeReport> { reportEntity };
        rewarded.AddRange(priorMatches);
        await XpRewardService.AwardForAppliedBarcodeReportsAsync(
            appDb, levelProgress, rewarded);
    }

    if (!applyNow)
    {
        // Pending report already saved above when tallying; keep a final save for
        // the duplicate-report image refresh path that never entered the tally block.
        await catalogDb.SaveChangesAsync();
        if (imageQueuedForValidation)
        {
            await appDb.SaveChangesAsync();
        }
    }

    var rating = key == MenyCatalogDbContext.CatalogFri
        ? GlutenRatings.GlutenFree
        : GlutenRatings.GlutenContent;
    var responseBarcode = applyNow ? suggested : currentBarcode;
    return Results.Ok(ToCatalogResponse(
        id,
        responseBarcode,
        productName,
        rating,
        DateTime.UtcNow,
        key,
        imageBase64,
        pending: !applyNow));
});

products.MapPost("/barcode-reports/{reportId:int}/approve", async (
    int reportId,
    HttpContext ctx,
    AppDbContext appDb,
    MenyCatalogDbContext catalogDb,
    LevelProgressTable levelProgress) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, appDb);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }
    if (!user.IsAdmin)
    {
        return Results.Json(new { error = "Admin access is required to approve barcode reports." }, statusCode: StatusCodes.Status403Forbidden);
    }

    var report = await catalogDb.BarcodeReports.FirstOrDefaultAsync(r => r.Id == reportId);
    if (report is null)
    {
        return Results.NotFound(new { error = "Barcode report not found." });
    }
    if (report.Applied)
    {
        return Results.Conflict(new { error = "This barcode report is already applied." });
    }

    var suggested = report.SuggestedBarcode.Trim();
    var key = report.Catalog.Trim().ToLowerInvariant();
    if (key is "fri") key = MenyCatalogDbContext.CatalogFri;
    if (key is "glutenholdig") key = MenyCatalogDbContext.CatalogGluten;

    var takenFri = await catalogDb.GlutenFriProducts.AnyAsync(p => p.Barcode == suggested);
    var takenGluten = await catalogDb.GlutenProducts.AnyAsync(p => p.Barcode == suggested);
    if (takenFri || takenGluten)
    {
        return Results.Conflict(new { error = "That barcode is already linked to another product." });
    }

    string? imageBase64 = null;
    string productName = report.ProductName;
    if (key == MenyCatalogDbContext.CatalogFri)
    {
        var fri = await catalogDb.GlutenFriProducts.FirstOrDefaultAsync(p => p.Id == report.ProductId);
        if (fri is null) return Results.NotFound(new { error = "Product not found." });
        if (!string.Equals(fri.Barcode, MenyCatalogDbContext.UnknownBarcode, StringComparison.OrdinalIgnoreCase))
        {
            return Results.Conflict(new { error = "This product already has a barcode." });
        }
        fri.Barcode = suggested;
        // Admin barcode approval may apply a photo that was attached by an admin report.
        if (!string.IsNullOrWhiteSpace(report.ImageBase64) && string.IsNullOrWhiteSpace(fri.ImageBase64))
        {
            fri.ImageBase64 = report.ImageBase64;
        }
        imageBase64 = fri.ImageBase64;
        productName = fri.Name;
    }
    else if (key == MenyCatalogDbContext.CatalogGluten)
    {
        var gluten = await catalogDb.GlutenProducts.FirstOrDefaultAsync(p => p.Id == report.ProductId);
        if (gluten is null) return Results.NotFound(new { error = "Product not found." });
        if (!string.Equals(gluten.Barcode, MenyCatalogDbContext.UnknownBarcode, StringComparison.OrdinalIgnoreCase))
        {
            return Results.Conflict(new { error = "This product already has a barcode." });
        }
        gluten.Barcode = suggested;
        if (!string.IsNullOrWhiteSpace(report.ImageBase64) && string.IsNullOrWhiteSpace(gluten.ImageBase64))
        {
            gluten.ImageBase64 = report.ImageBase64;
        }
        imageBase64 = gluten.ImageBase64;
        productName = gluten.Name;
    }
    else
    {
        return Results.BadRequest(new { error = "Invalid report catalog." });
    }

    report.Applied = true;

    var matchingReports = await catalogDb.BarcodeReports
        .Where(r =>
            r.Catalog == report.Catalog &&
            r.ProductId == report.ProductId &&
            r.SuggestedBarcode == suggested)
        .ToListAsync();
    foreach (var match in matchingReports)
    {
        match.Applied = true;
    }

    await catalogDb.SaveChangesAsync();
    await XpRewardService.AwardForAppliedBarcodeReportsAsync(
        appDb, levelProgress, matchingReports);

    var rating = key == MenyCatalogDbContext.CatalogFri
        ? GlutenRatings.GlutenFree
        : GlutenRatings.GlutenContent;
    return Results.Ok(ToCatalogResponse(
        report.ProductId, suggested, productName, rating, DateTime.UtcNow, key, imageBase64));
});

products.MapPost("/{catalog}/{id:int}/image-validations", async (
    string catalog,
    int id,
    SubmitProductImageRequest request,
    HttpContext ctx,
    AppDbContext appDb,
    MenyCatalogDbContext catalogDb) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, appDb);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in to submit a product image." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var key = catalog.Trim().ToLowerInvariant();
    if (key is "fri") key = MenyCatalogDbContext.CatalogFri;
    if (key is "glutenholdig") key = MenyCatalogDbContext.CatalogGluten;

    string productName;
    string? existingImage;
    if (key == MenyCatalogDbContext.CatalogFri)
    {
        var fri = await catalogDb.GlutenFriProducts.FirstOrDefaultAsync(p => p.Id == id);
        if (fri is null) return Results.NotFound(new { error = "Product not found." });
        productName = fri.Name;
        existingImage = fri.ImageBase64;
    }
    else if (key == MenyCatalogDbContext.CatalogGluten)
    {
        var gluten = await catalogDb.GlutenProducts.FirstOrDefaultAsync(p => p.Id == id);
        if (gluten is null) return Results.NotFound(new { error = "Product not found." });
        productName = gluten.Name;
        existingImage = gluten.ImageBase64;
    }
    else
    {
        return Results.BadRequest(new { error = "catalog must be glutenfri or gluten." });
    }

    if (!user.IsAdmin && !string.IsNullOrWhiteSpace(existingImage))
    {
        return Results.Conflict(new { error = "This product already has an image." });
    }

    var image = string.IsNullOrWhiteSpace(request.ImageBase64) ? null : request.ImageBase64.Trim();
    if (image is null)
    {
        return Results.BadRequest(new { error = "imageBase64 is required." });
    }
    if (!TryNormalizeImageBase64(image, out image, out var imageError) || image is null)
    {
        return Results.BadRequest(new { error = imageError });
    }

    // Admins may set the catalog image immediately.
    if (user.IsAdmin)
    {
        if (key == MenyCatalogDbContext.CatalogFri)
        {
            var fri = await catalogDb.GlutenFriProducts.FirstAsync(p => p.Id == id);
            fri.ImageBase64 = image;
            await catalogDb.SaveChangesAsync();
            return Results.Ok(ToCatalogResponse(
                fri.Id, fri.Barcode, fri.Name, GlutenRatings.GlutenFree, fri.CreatedAt, key,
                fri.ImageBase64, ingredients: fri.Ingredients, produsent: fri.Produsent));
        }

        var glutenRow = await catalogDb.GlutenProducts.FirstAsync(p => p.Id == id);
        glutenRow.ImageBase64 = image;
        await catalogDb.SaveChangesAsync();
        return Results.Ok(ToCatalogResponse(
            glutenRow.Id, glutenRow.Barcode, glutenRow.Name, GlutenRatings.GlutenContent,
            glutenRow.CreatedAt, key, glutenRow.ImageBase64,
            ingredients: glutenRow.Ingredients, produsent: glutenRow.Produsent));
    }

    await QueueOrUpdateProductImageValidationAsync(
        appDb, key, id, productName, image, user.Id);
    await appDb.SaveChangesAsync();

    return Results.Ok(new
    {
        pending = true,
        catalog = key,
        productId = id,
        message = "Image submitted for admin validation.",
    });
});

products.MapPost("/", async (
    NewProductRequest request,
    HttpContext ctx,
    AppDbContext appDb,
    MenyCatalogDbContext catalog) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, appDb);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var barcode = request.Barcode?.Trim();
    var name = request.Name?.Trim();
    var ingredients = request.Ingredients?.Trim();
    var produsentRaw = request.Produsent?.Trim();
    var produsent = string.IsNullOrEmpty(produsentRaw) ? null : produsentRaw;
    var rating = request.GlutenRating?.Trim();
    var imageBase64 = string.IsNullOrWhiteSpace(request.ImageBase64) ? null : request.ImageBase64.Trim();
    if (imageBase64 is not null && !TryNormalizeImageBase64(imageBase64, out imageBase64, out var imageError))
    {
        return Results.BadRequest(new { error = imageError });
    }
    if (string.IsNullOrEmpty(barcode))
    {
        // Admins clearing a barcode on edit store it as the catalog "unknown" sentinel.
        var isAdminEdit =
            user.IsAdmin &&
            request.Id is int clearId &&
            clearId > 0 &&
            !string.IsNullOrWhiteSpace(request.Catalog);
        if (isAdminEdit)
        {
            barcode = MenyCatalogDbContext.UnknownBarcode;
        }
        else
        {
            return Results.BadRequest(new { error = "Barcode is required." });
        }
    }
    if (string.IsNullOrEmpty(name))
    {
        return Results.BadRequest(new { error = "Product name is required." });
    }
    if (!GlutenRatings.IsValid(rating))
    {
        return Results.BadRequest(new
        {
            error = "gluten_rating must be one of: gluten_free, gluten_trace, gluten_content.",
        });
    }

    // Non-admins may submit products, but they are not applied to the live catalog.
    if (!user.IsAdmin)
    {
        if (string.IsNullOrWhiteSpace(imageBase64))
        {
            return Results.BadRequest(new { error = "A product photo is required for submissions." });
        }

        var nowPending = DateTime.UtcNow;
        var submission = new ProductSubmission
        {
            Barcode = barcode,
            Produsent = produsent,
            Name = name,
            Ingredients = string.IsNullOrEmpty(ingredients) ? null : ingredients,
            GlutenRating = rating!,
            ImageBase64 = imageBase64,
            SubmittedByUserId = user.Id,
            Status = ProductSubmission.PendingStatus,
            CreatedAt = nowPending,
        };
        appDb.ProductSubmissions.Add(submission);
        await appDb.SaveChangesAsync();
        return Results.Ok(new ProductResponse(
            submission.Id,
            submission.Barcode,
            submission.Name,
            submission.Ingredients,
            submission.GlutenRating,
            submission.CreatedAt,
            submission.CreatedAt,
            "pending",
            Pending: true,
            ImageBase64: submission.ImageBase64,
            Produsent: submission.Produsent));
    }

    var isFree = rating == GlutenRatings.GlutenFree;
    var now = DateTime.UtcNow;
    var targetCatalog = isFree ? MenyCatalogDbContext.CatalogFri : MenyCatalogDbContext.CatalogGluten;

    // Admin edit of an existing product (by catalog + id) — allows changing barcode.
    if (request.Id is int editId && editId > 0 && !string.IsNullOrWhiteSpace(request.Catalog))
    {
        var sourceKey = request.Catalog.Trim().ToLowerInvariant();
        if (sourceKey is "fri") sourceKey = MenyCatalogDbContext.CatalogFri;
        if (sourceKey is "glutenholdig") sourceKey = MenyCatalogDbContext.CatalogGluten;
        if (sourceKey is not (MenyCatalogDbContext.CatalogFri or MenyCatalogDbContext.CatalogGluten))
        {
            return Results.BadRequest(new { error = "catalog must be glutenfri or gluten." });
        }

        var isUnknownEdit = string.Equals(barcode, MenyCatalogDbContext.UnknownBarcode, StringComparison.OrdinalIgnoreCase);
        if (!isUnknownEdit)
        {
            var takenFri = await catalog.GlutenFriProducts.AnyAsync(p =>
                p.Barcode == barcode && !(sourceKey == MenyCatalogDbContext.CatalogFri && p.Id == editId));
            var takenGluten = await catalog.GlutenProducts.AnyAsync(p =>
                p.Barcode == barcode && !(sourceKey == MenyCatalogDbContext.CatalogGluten && p.Id == editId));
            if (takenFri || takenGluten)
            {
                return Results.Conflict(new { error = "That barcode is already linked to another product." });
            }
        }

        var finalIngredients = string.IsNullOrEmpty(ingredients) ? null : ingredients;

        // Same catalog: update in place (keeps id stable for favorites/lists).
        if (sourceKey == targetCatalog)
        {
            if (isFree)
            {
                var fri = await catalog.GlutenFriProducts.FirstOrDefaultAsync(p => p.Id == editId);
                if (fri is null) return Results.NotFound(new { error = "Product not found." });
                fri.Barcode = barcode;
                fri.Name = name;
                fri.Produsent = produsent;
                fri.Ingredients = finalIngredients;
                if (imageBase64 is not null)
                {
                    fri.ImageBase64 = imageBase64;
                }
                await catalog.SaveChangesAsync();
                return Results.Ok(ToCatalogResponse(
                    fri.Id, fri.Barcode, fri.Name, rating!, fri.CreatedAt, targetCatalog,
                    fri.ImageBase64, ingredients: fri.Ingredients, produsent: fri.Produsent));
            }

            var gluten = await catalog.GlutenProducts.FirstOrDefaultAsync(p => p.Id == editId);
            if (gluten is null) return Results.NotFound(new { error = "Product not found." });
            gluten.Barcode = barcode;
            gluten.Name = name;
            gluten.Produsent = produsent;
            gluten.Ingredients = finalIngredients;
            if (imageBase64 is not null)
            {
                gluten.ImageBase64 = imageBase64;
            }
            await catalog.SaveChangesAsync();
            return Results.Ok(ToCatalogResponse(
                gluten.Id, gluten.Barcode, gluten.Name, rating!, gluten.CreatedAt, targetCatalog,
                gluten.ImageBase64, ingredients: gluten.Ingredients, produsent: gluten.Produsent));
        }

        // Rating moved the product to the other catalog — copy then delete.
        string? existingImage;
        DateTime existingCreatedAt;
        if (sourceKey == MenyCatalogDbContext.CatalogFri)
        {
            var fri = await catalog.GlutenFriProducts.FirstOrDefaultAsync(p => p.Id == editId);
            if (fri is null) return Results.NotFound(new { error = "Product not found." });
            existingImage = fri.ImageBase64;
            existingCreatedAt = fri.CreatedAt;
            catalog.GlutenFriProducts.Remove(fri);
        }
        else
        {
            var gluten = await catalog.GlutenProducts.FirstOrDefaultAsync(p => p.Id == editId);
            if (gluten is null) return Results.NotFound(new { error = "Product not found." });
            existingImage = gluten.ImageBase64;
            existingCreatedAt = gluten.CreatedAt;
            catalog.GlutenProducts.Remove(gluten);
        }

        var movedImage = imageBase64 ?? existingImage;
        if (isFree)
        {
            var row = new GlutenFriItem
            {
                Barcode = barcode,
                Produsent = produsent,
                Name = name,
                Ingredients = finalIngredients,
                ImageBase64 = movedImage,
                CreatedAt = existingCreatedAt,
            };
            catalog.GlutenFriProducts.Add(row);
            await catalog.SaveChangesAsync();
            return Results.Ok(ToCatalogResponse(
                row.Id, row.Barcode, row.Name, rating!, row.CreatedAt, targetCatalog,
                row.ImageBase64, ingredients: row.Ingredients, produsent: row.Produsent));
        }

        {
            var row = new GlutenItem
            {
                Barcode = barcode,
                Produsent = produsent,
                Name = name,
                Ingredients = finalIngredients,
                ImageBase64 = movedImage,
                CreatedAt = existingCreatedAt,
            };
            catalog.GlutenProducts.Add(row);
            await catalog.SaveChangesAsync();
            return Results.Ok(ToCatalogResponse(
                row.Id, row.Barcode, row.Name, rating!, row.CreatedAt, targetCatalog,
                row.ImageBase64, ingredients: row.Ingredients, produsent: row.Produsent));
        }
    }

    var isUnknownBarcode = string.Equals(barcode, MenyCatalogDbContext.UnknownBarcode, StringComparison.OrdinalIgnoreCase);
    if (!isUnknownBarcode)
    {
        if (isFree)
        {
            await catalog.GlutenProducts.Where(p => p.Barcode == barcode).ExecuteDeleteAsync();
        }
        else
        {
            await catalog.GlutenFriProducts.Where(p => p.Barcode == barcode).ExecuteDeleteAsync();
        }
    }
    if (isFree)
    {
        GlutenFriItem row;
        if (isUnknownBarcode)
        {
            row = new GlutenFriItem
            {
                Barcode = barcode,
                Produsent = produsent,
                Name = name,
                Ingredients = string.IsNullOrEmpty(ingredients) ? null : ingredients,
                ImageBase64 = imageBase64,
                CreatedAt = now,
            };
            catalog.GlutenFriProducts.Add(row);
        }
        else
        {
            var existing = await catalog.GlutenFriProducts.FirstOrDefaultAsync(p => p.Barcode == barcode);
            if (existing is null)
            {
                row = new GlutenFriItem
                {
                    Barcode = barcode,
                    Produsent = produsent,
                    Name = name,
                    Ingredients = string.IsNullOrEmpty(ingredients) ? null : ingredients,
                    ImageBase64 = imageBase64,
                    CreatedAt = now,
                };
                catalog.GlutenFriProducts.Add(row);
            }
            else
            {
                existing.Name = name;
                existing.Produsent = produsent;
                existing.Ingredients = string.IsNullOrEmpty(ingredients) ? null : ingredients;
                if (imageBase64 is not null)
                {
                    existing.ImageBase64 = imageBase64;
                }
                row = existing;
            }
        }
        await catalog.SaveChangesAsync();
        return Results.Ok(ToCatalogResponse(
            row.Id, row.Barcode, row.Name, rating!, row.CreatedAt, MenyCatalogDbContext.CatalogFri,
            row.ImageBase64, ingredients: row.Ingredients, produsent: row.Produsent));
    }
    else
    {
        GlutenItem row;
        if (isUnknownBarcode)
        {
            row = new GlutenItem
            {
                Barcode = barcode,
                Produsent = produsent,
                Name = name,
                Ingredients = string.IsNullOrEmpty(ingredients) ? null : ingredients,
                ImageBase64 = imageBase64,
                CreatedAt = now,
            };
            catalog.GlutenProducts.Add(row);
        }
        else
        {
            var existing = await catalog.GlutenProducts.FirstOrDefaultAsync(p => p.Barcode == barcode);
            if (existing is null)
            {
                row = new GlutenItem
                {
                    Barcode = barcode,
                    Produsent = produsent,
                    Name = name,
                    Ingredients = string.IsNullOrEmpty(ingredients) ? null : ingredients,
                    ImageBase64 = imageBase64,
                    CreatedAt = now,
                };
                catalog.GlutenProducts.Add(row);
            }
            else
            {
                existing.Name = name;
                existing.Produsent = produsent;
                existing.Ingredients = string.IsNullOrEmpty(ingredients) ? null : ingredients;
                if (imageBase64 is not null)
                {
                    existing.ImageBase64 = imageBase64;
                }
                row = existing;
            }
        }
        await catalog.SaveChangesAsync();
        return Results.Ok(ToCatalogResponse(
            row.Id, row.Barcode, row.Name, rating!, row.CreatedAt, MenyCatalogDbContext.CatalogGluten,
            row.ImageBase64, ingredients: row.Ingredients, produsent: row.Produsent));
    }
});

var admin = app.MapGroup("/api/admin");
const int ProductSubmissionsPageSize = 10;

admin.MapGet("/product-submissions", async (
    HttpContext ctx,
    AppDbContext appDb,
    int? page) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, appDb);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }
    if (!user.IsAdmin)
    {
        return Results.Json(new { error = "Admin access is required." }, statusCode: StatusCodes.Status403Forbidden);
    }

    var pageNumber = Math.Max(1, page ?? 1);
    var query = appDb.ProductSubmissions
        .AsNoTracking()
        .Where(s => s.Status == ProductSubmission.PendingStatus);

    var totalCount = await query.CountAsync();
    var rows = await query
        .OrderBy(s => s.CreatedAt)
        .ThenBy(s => s.Id)
        .Skip((pageNumber - 1) * ProductSubmissionsPageSize)
        .Take(ProductSubmissionsPageSize)
        .ToListAsync();

    var submitterIds = rows.Select(r => r.SubmittedByUserId).Distinct().ToList();
    var usernames = submitterIds.Count == 0
        ? new Dictionary<int, string>()
        : await appDb.Users
            .AsNoTracking()
            .Where(u => submitterIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Username);

    var items = rows.Select(s => new ProductSubmissionResponse(
        s.Id,
        s.Barcode,
        s.Name,
        s.Ingredients,
        s.GlutenRating,
        s.ImageBase64,
        s.SubmittedByUserId,
        usernames.GetValueOrDefault(s.SubmittedByUserId),
        s.Status,
        s.CreatedAt,
        s.Produsent)).ToList();

    return Results.Ok(new ProductSubmissionListResponse(
        items, pageNumber, ProductSubmissionsPageSize, totalCount));
});

admin.MapPost("/product-submissions/{id:int}/approve", async (
    int id,
    ApproveProductSubmissionRequest? request,
    HttpContext ctx,
    AppDbContext appDb,
    MenyCatalogDbContext catalog,
    LevelProgressTable levelProgress) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, appDb);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }
    if (!user.IsAdmin)
    {
        return Results.Json(new { error = "Admin access is required." }, statusCode: StatusCodes.Status403Forbidden);
    }

    var submission = await appDb.ProductSubmissions.FirstOrDefaultAsync(s => s.Id == id);
    if (submission is null)
    {
        return Results.NotFound(new { error = "Product submission not found." });
    }
    if (submission.Status != ProductSubmission.PendingStatus)
    {
        return Results.Conflict(new { error = "This submission has already been reviewed." });
    }

    var barcode = string.IsNullOrWhiteSpace(request?.Barcode)
        ? submission.Barcode.Trim()
        : request!.Barcode.Trim();
    var name = string.IsNullOrWhiteSpace(request?.Name)
        ? submission.Name.Trim()
        : request!.Name.Trim();
    var rating = string.IsNullOrWhiteSpace(request?.GlutenRating)
        ? submission.GlutenRating.Trim()
        : request!.GlutenRating.Trim();
    string? ingredients;
    if (request?.Ingredients is not null)
    {
        var trimmedIngredients = request.Ingredients.Trim();
        ingredients = trimmedIngredients.Length == 0 ? null : trimmedIngredients;
    }
    else
    {
        ingredients = string.IsNullOrWhiteSpace(submission.Ingredients)
            ? null
            : submission.Ingredients.Trim();
    }
    string? produsent;
    if (request?.Produsent is not null)
    {
        var trimmedProdusent = request.Produsent.Trim();
        produsent = trimmedProdusent.Length == 0 ? null : trimmedProdusent;
    }
    else
    {
        produsent = string.IsNullOrWhiteSpace(submission.Produsent)
            ? null
            : submission.Produsent.Trim();
    }

    if (name.Length == 0)
    {
        return Results.BadRequest(new { error = "Product name is required." });
    }
    if (!GlutenRatings.IsValid(rating))
    {
        return Results.BadRequest(new { error = "Submission has an invalid gluten rating." });
    }

    var isFree = rating == GlutenRatings.GlutenFree;
    var now = DateTime.UtcNow;
    var isUnknown = string.Equals(barcode, MenyCatalogDbContext.UnknownBarcode, StringComparison.OrdinalIgnoreCase);

    if (!isUnknown)
    {
        var takenFri = await catalog.GlutenFriProducts.AnyAsync(p => p.Barcode == barcode);
        var takenGluten = await catalog.GlutenProducts.AnyAsync(p => p.Barcode == barcode);
        if (takenFri || takenGluten)
        {
            return Results.Conflict(new { error = "That barcode is already linked to another product." });
        }
    }

    // Persist admin edits on the submission before applying to the catalog.
    submission.Barcode = barcode;
    submission.Name = name;
    submission.Produsent = produsent;
    submission.Ingredients = ingredients;
    submission.GlutenRating = rating;

    string catalogKey;
    int productId;
    var submissionImage = string.IsNullOrWhiteSpace(submission.ImageBase64) ? null : submission.ImageBase64;
    if (isFree)
    {
        catalogKey = MenyCatalogDbContext.CatalogFri;
        var row = new GlutenFriItem
        {
            Barcode = barcode,
            Produsent = produsent,
            Name = name,
            Ingredients = ingredients,
            ImageBase64 = submissionImage,
            CreatedAt = now,
        };
        catalog.GlutenFriProducts.Add(row);
        await catalog.SaveChangesAsync();
        productId = row.Id;
    }
    else
    {
        catalogKey = MenyCatalogDbContext.CatalogGluten;
        var row = new GlutenItem
        {
            Barcode = barcode,
            Produsent = produsent,
            Name = name,
            Ingredients = ingredients,
            ImageBase64 = submissionImage,
            CreatedAt = now,
        };
        catalog.GlutenProducts.Add(row);
        await catalog.SaveChangesAsync();
        productId = row.Id;
    }

    submission.Status = ProductSubmission.ApprovedStatus;
    await appDb.SaveChangesAsync();
    await XpRewardService.AwardForApprovedProductSubmissionAsync(appDb, levelProgress, submission);

    return Results.Ok(ToCatalogResponse(
        productId, barcode, name, rating, now, catalogKey, submissionImage,
        ingredients: ingredients, produsent: produsent));
});

admin.MapPost("/product-submissions/{id:int}/deny", async (
    int id,
    HttpContext ctx,
    AppDbContext appDb) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, appDb);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }
    if (!user.IsAdmin)
    {
        return Results.Json(new { error = "Admin access is required." }, statusCode: StatusCodes.Status403Forbidden);
    }

    var submission = await appDb.ProductSubmissions.FirstOrDefaultAsync(s => s.Id == id);
    if (submission is null)
    {
        return Results.NotFound(new { error = "Product submission not found." });
    }
    if (submission.Status != ProductSubmission.PendingStatus)
    {
        return Results.Conflict(new { error = "This submission has already been reviewed." });
    }

    submission.Status = ProductSubmission.DeniedStatus;
    await appDb.SaveChangesAsync();
    return Results.Ok(new { id = submission.Id, status = submission.Status });
});

const int ProductImageValidationsPageSize = 10;

admin.MapGet("/product-image-validations", async (
    HttpContext ctx,
    AppDbContext appDb,
    int? page) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, appDb);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }
    if (!user.IsAdmin)
    {
        return Results.Json(new { error = "Admin access is required." }, statusCode: StatusCodes.Status403Forbidden);
    }

    var pageNumber = Math.Max(1, page ?? 1);
    var query = appDb.ProductImageValidations
        .AsNoTracking()
        .Where(v => v.Status == ProductImageValidation.PendingStatus);

    var totalCount = await query.CountAsync();
    var rows = await query
        .OrderBy(v => v.CreatedAt)
        .ThenBy(v => v.Id)
        .Skip((pageNumber - 1) * ProductImageValidationsPageSize)
        .Take(ProductImageValidationsPageSize)
        .ToListAsync();

    var submitterIds = rows.Select(r => r.SubmittedByUserId).Distinct().ToList();
    var usernames = submitterIds.Count == 0
        ? new Dictionary<int, string>()
        : await appDb.Users
            .AsNoTracking()
            .Where(u => submitterIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Username);

    var items = rows.Select(v => new ProductImageValidationResponse(
        v.Id,
        v.Catalog,
        v.ProductId,
        v.ProductName,
        v.ImageBase64,
        v.SubmittedByUserId,
        usernames.GetValueOrDefault(v.SubmittedByUserId),
        v.Status,
        v.CreatedAt)).ToList();

    return Results.Ok(new ProductImageValidationListResponse(
        items, pageNumber, ProductImageValidationsPageSize, totalCount));
});

admin.MapPost("/product-image-validations/{id:int}/approve", async (
    int id,
    HttpContext ctx,
    AppDbContext appDb,
    MenyCatalogDbContext catalog,
    LevelProgressTable levelProgress) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, appDb);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }
    if (!user.IsAdmin)
    {
        return Results.Json(new { error = "Admin access is required." }, statusCode: StatusCodes.Status403Forbidden);
    }

    var validation = await appDb.ProductImageValidations.FirstOrDefaultAsync(v => v.Id == id);
    if (validation is null)
    {
        return Results.NotFound(new { error = "Image validation not found." });
    }
    if (validation.Status != ProductImageValidation.PendingStatus)
    {
        return Results.Conflict(new { error = "This image has already been reviewed." });
    }

    var key = validation.Catalog.Trim().ToLowerInvariant();
    if (key is "fri") key = MenyCatalogDbContext.CatalogFri;
    if (key is "glutenholdig") key = MenyCatalogDbContext.CatalogGluten;

    string? imageBase64 = validation.ImageBase64;
    string productName = validation.ProductName;
    string barcode;
    string rating;
    string? ingredients;
    string? produsent;
    DateTime createdAt;

    if (key == MenyCatalogDbContext.CatalogFri)
    {
        var fri = await catalog.GlutenFriProducts.FirstOrDefaultAsync(p => p.Id == validation.ProductId);
        if (fri is null)
        {
            return Results.NotFound(new { error = "Product not found." });
        }
        fri.ImageBase64 = imageBase64;
        barcode = fri.Barcode;
        productName = fri.Name;
        ingredients = fri.Ingredients;
        produsent = fri.Produsent;
        createdAt = fri.CreatedAt;
        rating = GlutenRatings.GlutenFree;
    }
    else if (key == MenyCatalogDbContext.CatalogGluten)
    {
        var gluten = await catalog.GlutenProducts.FirstOrDefaultAsync(p => p.Id == validation.ProductId);
        if (gluten is null)
        {
            return Results.NotFound(new { error = "Product not found." });
        }
        gluten.ImageBase64 = imageBase64;
        barcode = gluten.Barcode;
        productName = gluten.Name;
        ingredients = gluten.Ingredients;
        produsent = gluten.Produsent;
        createdAt = gluten.CreatedAt;
        rating = GlutenRatings.GlutenContent;
    }
    else
    {
        return Results.BadRequest(new { error = "Invalid validation catalog." });
    }

    validation.Status = ProductImageValidation.ApprovedStatus;

    // Auto-deny other pending photos for the same product.
    var siblings = await appDb.ProductImageValidations
        .Where(v =>
            v.Id != validation.Id &&
            v.Catalog == validation.Catalog &&
            v.ProductId == validation.ProductId &&
            v.Status == ProductImageValidation.PendingStatus)
        .ToListAsync();
    foreach (var sibling in siblings)
    {
        sibling.Status = ProductImageValidation.DeniedStatus;
    }

    await catalog.SaveChangesAsync();
    await appDb.SaveChangesAsync();
    await XpRewardService.AwardForApprovedProductImageValidationAsync(
        appDb, levelProgress, validation);

    return Results.Ok(ToCatalogResponse(
        validation.ProductId, barcode, productName, rating, createdAt, key,
        imageBase64, ingredients: ingredients, produsent: produsent));
});

admin.MapPost("/product-image-validations/{id:int}/deny", async (
    int id,
    HttpContext ctx,
    AppDbContext appDb) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, appDb);
    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }
    if (!user.IsAdmin)
    {
        return Results.Json(new { error = "Admin access is required." }, statusCode: StatusCodes.Status403Forbidden);
    }

    var validation = await appDb.ProductImageValidations.FirstOrDefaultAsync(v => v.Id == id);
    if (validation is null)
    {
        return Results.NotFound(new { error = "Image validation not found." });
    }
    if (validation.Status != ProductImageValidation.PendingStatus)
    {
        return Results.Conflict(new { error = "This image has already been reviewed." });
    }

    validation.Status = ProductImageValidation.DeniedStatus;
    await appDb.SaveChangesAsync();
    return Results.Ok(new { id = validation.Id, status = validation.Status });
});

app.Run();
static ProductResponse ToCatalogResponse(
    int id,
    string barcode,
    string name,
    string rating,
    DateTime createdAt,
    string catalog,
    string? imageBase64 = null,
    bool pending = false,
    string? ingredients = null,
    string? produsent = null) =>
    new(id, barcode, name, ingredients, rating, createdAt, createdAt, catalog, Pending: pending, ImageBase64: imageBase64, Produsent: produsent);

const int MaxProductImageBytes = 5 * 1024 * 1024;

static async Task QueueOrUpdateProductImageValidationAsync(
    AppDbContext appDb,
    string catalog,
    int productId,
    string productName,
    string imageBase64,
    int userId)
{
    var existing = await appDb.ProductImageValidations
        .Where(v =>
            v.Catalog == catalog &&
            v.ProductId == productId &&
            v.SubmittedByUserId == userId &&
            v.Status == ProductImageValidation.PendingStatus)
        .OrderByDescending(v => v.Id)
        .FirstOrDefaultAsync();

    if (existing is not null)
    {
        existing.ImageBase64 = imageBase64;
        existing.ProductName = productName;
        existing.CreatedAt = DateTime.UtcNow;
        return;
    }

    appDb.ProductImageValidations.Add(new ProductImageValidation
    {
        Catalog = catalog,
        ProductId = productId,
        ProductName = productName,
        ImageBase64 = imageBase64,
        SubmittedByUserId = userId,
        Status = ProductImageValidation.PendingStatus,
        CreatedAt = DateTime.UtcNow,
    });
}

static bool TryNormalizeImageBase64(string input, out string? normalized, out string error)
{
    normalized = null;
    error = string.Empty;
    var value = input.Trim();
    if (value.Length == 0)
    {
        return true;
    }

    var payload = value;
    var comma = value.IndexOf("base64,", StringComparison.OrdinalIgnoreCase);
    if (comma >= 0)
    {
        payload = value[(comma + "base64,".Length)..];
    }

    payload = payload.Replace("\r", string.Empty, StringComparison.Ordinal)
                     .Replace("\n", string.Empty, StringComparison.Ordinal)
                     .Replace(" ", string.Empty, StringComparison.Ordinal);

    byte[] bytes;
    try
    {
        bytes = Convert.FromBase64String(payload);
    }
    catch (FormatException)
    {
        error = "Image data is not valid base64.";
        return false;
    }

    if (bytes.Length > MaxProductImageBytes)
    {
        error = "Image must be 5 MB or smaller.";
        return false;
    }

    normalized = value.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase)
        ? value
        : $"data:image/jpeg;base64,{payload}";
    return true;
}

static UserResponse ToUserResponse(User u) =>
    new(
        u.Id,
        u.Username,
        u.Level,
        u.Xp,
        u.IsAdmin,
        u.PublicUser,
        u.ProfileImageBase64,
        ParseFavorites(u.FavoritesJson));

static JsonSerializerOptions CreateFavoritesJsonOptions() => new()
{
    PropertyNameCaseInsensitive = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
};

static IReadOnlyList<FavoriteProductRef> ParseFavorites(string? json)
{
    if (string.IsNullOrWhiteSpace(json))
    {
        return [];
    }

    try
    {
        var items = JsonSerializer.Deserialize<List<FavoriteProductRef>>(json, CreateFavoritesJsonOptions());
        if (items is null || items.Count == 0)
        {
            return [];
        }

        return items
            .Select(NormalizeFavoriteOrNull)
            .Where(f => f is not null)
            .Cast<FavoriteProductRef>()
            .GroupBy(f => $"{f.Catalog}:{f.Id}", StringComparer.Ordinal)
            .Select(g => g.First())
            .ToList();
    }
    catch (JsonException)
    {
        return [];
    }
}

static string SerializeFavorites(IEnumerable<FavoriteProductRef> favorites) =>
    JsonSerializer.Serialize(favorites.ToList(), CreateFavoritesJsonOptions());

static FavoriteProductRef? NormalizeFavoriteOrNull(FavoriteProductRef? value)
{
    if (value is null || value.Id <= 0 || string.IsNullOrWhiteSpace(value.Catalog))
    {
        return null;
    }

    var key = value.Catalog.Trim().ToLowerInvariant();
    if (key is "fri" or MenyCatalogDbContext.CatalogFri)
    {
        return new FavoriteProductRef(MenyCatalogDbContext.CatalogFri, value.Id);
    }

    if (key is "glutenholdig" or MenyCatalogDbContext.CatalogGluten)
    {
        return new FavoriteProductRef(MenyCatalogDbContext.CatalogGluten, value.Id);
    }

    return null;
}

static bool TryNormalizeFavorite(
    FavoriteProductRef? value,
    out FavoriteProductRef normalized,
    out string error)
{
    normalized = new FavoriteProductRef(MenyCatalogDbContext.CatalogFri, 0);
    error = string.Empty;
    var item = NormalizeFavoriteOrNull(value);
    if (item is null)
    {
        error = "Each favorite needs catalog (glutenfri|gluten) and a positive id.";
        return false;
    }

    normalized = item;
    return true;
}

static bool TryNormalizeFavorites(
    IReadOnlyList<FavoriteProductRef> input,
    out List<FavoriteProductRef> normalized,
    out string error)
{
    normalized = [];
    error = string.Empty;
    var seen = new HashSet<string>(StringComparer.Ordinal);
    foreach (var raw in input)
    {
        if (!TryNormalizeFavorite(raw, out var item, out error))
        {
            return false;
        }

        var key = $"{item.Catalog}:{item.Id}";
        if (seen.Add(key))
        {
            normalized.Add(item);
        }
    }

    return true;
}

static string EscapeLike(string value) =>
    value.Replace("[", "[[]", StringComparison.Ordinal)
         .Replace("%", "[%]", StringComparison.Ordinal)
         .Replace("_", "[_]", StringComparison.Ordinal);

static bool CanAccessList(ProductList list, int userId) =>
    list.OwnerId == userId || ParseSharedUserIds(list.SharedUserIdsJson).Contains(userId);

static IReadOnlyList<int> ParseSharedUserIds(string? json)
{
    if (string.IsNullOrWhiteSpace(json))
    {
        return [];
    }

    try
    {
        var items = JsonSerializer.Deserialize<List<int>>(json, CreateFavoritesJsonOptions());
        if (items is null || items.Count == 0)
        {
            return [];
        }

        return items.Where(id => id > 0).Distinct().ToList();
    }
    catch (JsonException)
    {
        return [];
    }
}

static string SerializeSharedUserIds(IEnumerable<int> ids) =>
    JsonSerializer.Serialize(ids.Where(id => id > 0).Distinct().ToList(), CreateFavoritesJsonOptions());

static async Task<ProductListResponse> ToProductListResponseAsync(
    ProductList list,
    User viewer,
    AppDbContext db)
{
    var sharedIds = ParseSharedUserIds(list.SharedUserIdsJson).ToList();
    var products = ParseFavorites(list.ProductIdsJson);
    var usernames = new List<string>();
    if (sharedIds.Count > 0)
    {
        var users = await db.Users.AsNoTracking()
            .Where(u => sharedIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Username })
            .ToListAsync();
        var byId = users.ToDictionary(u => u.Id, u => u.Username);
        foreach (var sid in sharedIds)
        {
            if (byId.TryGetValue(sid, out var name))
            {
                usernames.Add(name);
            }
        }
    }

    var ownerName = list.Owner?.Username
        ?? await db.Users.AsNoTracking()
            .Where(u => u.Id == list.OwnerId)
            .Select(u => u.Username)
            .FirstOrDefaultAsync()
        ?? string.Empty;

    return new ProductListResponse(
        list.Id,
        list.Name,
        list.OwnerId,
        ownerName,
        list.OwnerId == viewer.Id,
        list.CreatedAt,
        sharedIds,
        usernames,
        products);
}

static async Task<AuthResponse> CreateSessionAsync(AppDbContext db, User user)
{
    var now = DateTime.UtcNow;
    var session = new UserSession
    {
        UserId = user.Id,
        Token = AuthHelper.GenerateToken(),
        CreatedAt = now,
        ExpiresAt = now.Add(AuthHelper.SessionLifetime),
    };
    db.Sessions.Add(session);
    await db.SaveChangesAsync();
    return new AuthResponse(session.Token, session.ExpiresAt, ToUserResponse(user));
}
static async Task EnsureCatalogSchemaAsync(MenyCatalogDbContext catalog)
{
    await catalog.Database.ExecuteSqlRawAsync("""
IF OBJECT_ID(N'dbo.glutenfri_new', N'U') IS NOT NULL DROP TABLE dbo.glutenfri_new;
IF OBJECT_ID(N'dbo.gluten_new', N'U') IS NOT NULL DROP TABLE dbo.gluten_new;

IF OBJECT_ID(N'dbo.glutenfri', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.glutenfri (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_glutenfri PRIMARY KEY,
    barcode NVARCHAR(64) NOT NULL,
    name NVARCHAR(512) NOT NULL,
    image_base64 NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_glutenfri_created DEFAULT SYSUTCDATETIME()
  );
END
ELSE IF COL_LENGTH(N'dbo.glutenfri', N'id') IS NULL
BEGIN
  DECLARE @pk_fri sysname =
    (SELECT name FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.glutenfri') AND type = N'PK');
  IF @pk_fri IS NOT NULL
    EXEC(N'ALTER TABLE dbo.glutenfri DROP CONSTRAINT [' + @pk_fri + N']');
  ALTER TABLE dbo.glutenfri ADD id INT IDENTITY(1,1) NOT NULL;
  ALTER TABLE dbo.glutenfri ADD CONSTRAINT PK_glutenfri PRIMARY KEY (id);
END

IF OBJECT_ID(N'dbo.gluten', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.gluten (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_gluten PRIMARY KEY,
    barcode NVARCHAR(64) NOT NULL,
    name NVARCHAR(512) NOT NULL,
    image_base64 NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_gluten_created DEFAULT SYSUTCDATETIME()
  );
END
ELSE IF COL_LENGTH(N'dbo.gluten', N'id') IS NULL
BEGIN
  DECLARE @pk_g sysname =
    (SELECT name FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.gluten') AND type = N'PK');
  IF @pk_g IS NOT NULL
    EXEC(N'ALTER TABLE dbo.gluten DROP CONSTRAINT [' + @pk_g + N']');
  ALTER TABLE dbo.gluten ADD id INT IDENTITY(1,1) NOT NULL;
  ALTER TABLE dbo.gluten ADD CONSTRAINT PK_gluten PRIMARY KEY (id);
END

IF COL_LENGTH(N'dbo.glutenfri', N'image_base64') IS NULL
  ALTER TABLE dbo.glutenfri ADD image_base64 NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.gluten', N'image_base64') IS NULL
  ALTER TABLE dbo.gluten ADD image_base64 NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.glutenfri', N'ingredients') IS NULL
  ALTER TABLE dbo.glutenfri ADD ingredients NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.gluten', N'ingredients') IS NULL
  ALTER TABLE dbo.gluten ADD ingredients NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.glutenfri', N'produsent') IS NULL
  ALTER TABLE dbo.glutenfri ADD produsent NVARCHAR(256) NULL;
IF COL_LENGTH(N'dbo.gluten', N'produsent') IS NULL
  ALTER TABLE dbo.gluten ADD produsent NVARCHAR(256) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_glutenfri_barcode_known' AND object_id = OBJECT_ID(N'dbo.glutenfri'))
  CREATE UNIQUE INDEX UX_glutenfri_barcode_known ON dbo.glutenfri(barcode) WHERE barcode <> N'unknown';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_glutenfri_name' AND object_id = OBJECT_ID(N'dbo.glutenfri'))
  CREATE INDEX IX_glutenfri_name ON dbo.glutenfri(name);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_gluten_barcode_known' AND object_id = OBJECT_ID(N'dbo.gluten'))
  CREATE UNIQUE INDEX UX_gluten_barcode_known ON dbo.gluten(barcode) WHERE barcode <> N'unknown';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_gluten_name' AND object_id = OBJECT_ID(N'dbo.gluten'))
  CREATE INDEX IX_gluten_name ON dbo.gluten(name);

IF OBJECT_ID(N'dbo.barcode_reports', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.barcode_reports (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_barcode_reports PRIMARY KEY,
    catalog NVARCHAR(16) NOT NULL,
    product_id INT NOT NULL,
    product_name NVARCHAR(512) NOT NULL,
    suggested_barcode NVARCHAR(64) NOT NULL,
    image_base64 NVARCHAR(MAX) NULL,
    reported_by_user_id INT NULL,
    applied BIT NOT NULL CONSTRAINT DF_barcode_reports_applied DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_barcode_reports_created DEFAULT SYSUTCDATETIME()
  );
END
IF COL_LENGTH(N'dbo.barcode_reports', N'image_base64') IS NULL
  ALTER TABLE dbo.barcode_reports ADD image_base64 NVARCHAR(MAX) NULL;
""");
}
