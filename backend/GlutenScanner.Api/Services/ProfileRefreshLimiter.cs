namespace GlutenScanner.Api.Services;

/// <summary>
/// Limits profile XP/history refresh to once per user every <see cref="Cooldown"/>.
/// </summary>
public sealed class ProfileRefreshLimiter
{
    public static readonly TimeSpan Cooldown = TimeSpan.FromSeconds(20);

    private readonly object _gate = new();
    private readonly Dictionary<int, DateTime> _lastRefreshUtc = new();

    /// <summary>
    /// Returns true if the refresh is allowed. Otherwise sets
    /// <paramref name="retryAfterSeconds"/> to how long the client must wait.
    /// </summary>
    public bool TryAcquire(int userId, out int retryAfterSeconds)
    {
        var now = DateTime.UtcNow;
        lock (_gate)
        {
            if (_lastRefreshUtc.TryGetValue(userId, out var last))
            {
                var elapsed = now - last;
                if (elapsed < Cooldown)
                {
                    retryAfterSeconds = Math.Max(
                        1,
                        (int)Math.Ceiling((Cooldown - elapsed).TotalSeconds));
                    return false;
                }
            }

            _lastRefreshUtc[userId] = now;
            retryAfterSeconds = 0;
            return true;
        }
    }
}
