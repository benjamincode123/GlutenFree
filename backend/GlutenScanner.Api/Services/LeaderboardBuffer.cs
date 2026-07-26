using GlutenScanner.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GlutenScanner.Api.Services;

public record LeaderboardEntryDto(
    int Rank,
    int? UserId,
    string Username,
    int XpGained,
    bool IsPublic,
    bool IsViewer = false);

public record LeaderboardPeriodDto(
    string Period,
    DateTime WindowStartUtc,
    IReadOnlyList<LeaderboardEntryDto> Entries);

public record LeaderboardResponseDto(
    DateTime GeneratedAtUtc,
    DateTime NextRefreshUtc,
    LeaderboardPeriodDto Day,
    LeaderboardPeriodDto Week,
    LeaderboardPeriodDto Month);

/// <summary>
/// In-memory leaderboard buffer refreshed on an hourly schedule from xp_progress.
/// </summary>
public sealed class LeaderboardBuffer
{
    public const int TopCount = 100;
    public static readonly TimeSpan RefreshInterval = TimeSpan.FromHours(1);

    private readonly object _gate = new();
    private LeaderboardResponseDto _snapshot = EmptySnapshot(DateTime.UtcNow);

    /// <summary>
    /// Returns a viewer-safe copy: non-public entries have <c>UserId</c> cleared;
    /// the viewer's own row is flagged with <c>IsViewer</c>.
    /// </summary>
    public LeaderboardResponseDto GetSnapshotForViewer(int viewerUserId)
    {
        lock (_gate)
        {
            return ProjectForViewer(_snapshot, viewerUserId);
        }
    }

    private static LeaderboardResponseDto ProjectForViewer(LeaderboardResponseDto snap, int viewerUserId) =>
        new(
            snap.GeneratedAtUtc,
            snap.NextRefreshUtc,
            ProjectPeriod(snap.Day, viewerUserId),
            ProjectPeriod(snap.Week, viewerUserId),
            ProjectPeriod(snap.Month, viewerUserId));

    private static LeaderboardPeriodDto ProjectPeriod(LeaderboardPeriodDto period, int viewerUserId)
    {
        var entries = period.Entries
            .Select(e =>
            {
                var isViewer = e.UserId == viewerUserId;
                return e with
                {
                    // Hide identity for private profiles (including the viewer's own id).
                    UserId = e.IsPublic ? e.UserId : null,
                    IsViewer = isViewer,
                };
            })
            .ToList();
        return period with { Entries = entries };
    }

    public void Replace(LeaderboardResponseDto snapshot)
    {
        lock (_gate)
        {
            _snapshot = snapshot;
        }
    }

    /// <summary>
    /// Updates privacy fields for one user across all periods if they are on the board.
    /// Does not rebuild XP rankings — <see cref="UserId"/> stays in the buffer for later masking.
    /// </summary>
    public void ApplyPrivacyChange(int userId, bool isPublic, string username)
    {
        lock (_gate)
        {
            _snapshot = new LeaderboardResponseDto(
                _snapshot.GeneratedAtUtc,
                _snapshot.NextRefreshUtc,
                PatchPeriod(_snapshot.Day, userId, isPublic, username),
                PatchPeriod(_snapshot.Week, userId, isPublic, username),
                PatchPeriod(_snapshot.Month, userId, isPublic, username));
        }
    }

    private static LeaderboardPeriodDto PatchPeriod(
        LeaderboardPeriodDto period,
        int userId,
        bool isPublic,
        string username)
    {
        var changed = false;
        var entries = new List<LeaderboardEntryDto>(period.Entries.Count);
        foreach (var e in period.Entries)
        {
            if (e.UserId != userId)
            {
                entries.Add(e);
                continue;
            }

            changed = true;
            entries.Add(e with
            {
                IsPublic = isPublic,
                Username = isPublic ? username : string.Empty,
            });
        }

        return changed ? period with { Entries = entries } : period;
    }

    public static async Task<LeaderboardResponseDto> BuildAsync(
        AppDbContext db,
        DateTime nowUtc,
        CancellationToken cancellationToken = default)
    {
        var dayStart = nowUtc.Date;
        var weekStart = StartOfWeekMonday(nowUtc);
        var monthStart = new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var day = await LoadPeriodAsync(db, "day", dayStart, cancellationToken);
        var week = await LoadPeriodAsync(db, "week", weekStart, cancellationToken);
        var month = await LoadPeriodAsync(db, "month", monthStart, cancellationToken);

        return new LeaderboardResponseDto(
            nowUtc,
            nowUtc.Add(RefreshInterval),
            day,
            week,
            month);
    }

    private static async Task<LeaderboardPeriodDto> LoadPeriodAsync(
        AppDbContext db,
        string period,
        DateTime windowStartUtc,
        CancellationToken cancellationToken)
    {
        var totals = await db.XpProgress
            .AsNoTracking()
            .Where(x => x.CreatedAt >= windowStartUtc)
            .GroupBy(x => x.UserId)
            .Select(g => new { UserId = g.Key, XpGained = g.Sum(x => x.XpAmount) })
            .OrderByDescending(x => x.XpGained)
            .ThenBy(x => x.UserId)
            .Take(TopCount)
            .ToListAsync(cancellationToken);

        if (totals.Count == 0)
        {
            return new LeaderboardPeriodDto(period, windowStartUtc, Array.Empty<LeaderboardEntryDto>());
        }

        var userIds = totals.Select(t => t.UserId).ToList();
        var users = await db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Username, u.PublicUser })
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        var entries = totals
            .Select((t, index) =>
            {
                users.TryGetValue(t.UserId, out var profile);
                var isPublic = profile?.PublicUser == true;
                var displayName = isPublic
                    ? (profile!.Username)
                    : string.Empty;
                return new LeaderboardEntryDto(
                    index + 1,
                    t.UserId,
                    displayName,
                    t.XpGained,
                    isPublic);
            })
            .ToList();

        return new LeaderboardPeriodDto(period, windowStartUtc, entries);
    }

    private static DateTime StartOfWeekMonday(DateTime utcNow)
    {
        var date = utcNow.Date;
        var diff = ((int)date.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        return date.AddDays(-diff);
    }

    private static LeaderboardResponseDto EmptySnapshot(DateTime nowUtc) =>
        new(
            nowUtc,
            nowUtc.Add(RefreshInterval),
            new LeaderboardPeriodDto("day", nowUtc.Date, Array.Empty<LeaderboardEntryDto>()),
            new LeaderboardPeriodDto("week", StartOfWeekMonday(nowUtc), Array.Empty<LeaderboardEntryDto>()),
            new LeaderboardPeriodDto("month", new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc), Array.Empty<LeaderboardEntryDto>()));
}

/// <summary>Rebuilds the leaderboard buffer on startup and every hour.</summary>
public sealed class LeaderboardRefreshHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly LeaderboardBuffer _buffer;
    private readonly ILogger<LeaderboardRefreshHostedService> _logger;

    public LeaderboardRefreshHostedService(
        IServiceScopeFactory scopeFactory,
        LeaderboardBuffer buffer,
        ILogger<LeaderboardRefreshHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _buffer = buffer;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RefreshSafeAsync(stoppingToken);

        using var timer = new PeriodicTimer(LeaderboardBuffer.RefreshInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await RefreshSafeAsync(stoppingToken);
        }
    }

    private async Task RefreshSafeAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var snapshot = await LeaderboardBuffer.BuildAsync(db, DateTime.UtcNow, cancellationToken);
            _buffer.Replace(snapshot);
            _logger.LogInformation(
                "Leaderboard buffer refreshed at {AtUtc:u} (day={Day}, week={Week}, month={Month})",
                snapshot.GeneratedAtUtc,
                snapshot.Day.Entries.Count,
                snapshot.Week.Entries.Count,
                snapshot.Month.Entries.Count);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Shutting down.
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refresh leaderboard buffer.");
        }
    }
}
