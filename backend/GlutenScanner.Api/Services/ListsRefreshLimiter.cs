namespace GlutenScanner.Api.Services;

/// <summary>
/// Limits list collection fetches (mine/shared) to once per user+scope every
/// <see cref="Cooldown"/>.
/// </summary>
public sealed class ListsRefreshLimiter
{
    public static readonly TimeSpan Cooldown = TimeSpan.FromSeconds(10);

    private readonly object _gate = new();
    private readonly Dictionary<string, DateTime> _lastRefreshUtc = new();

    /// <summary>
    /// Returns true if the refresh is allowed. Otherwise sets
    /// <paramref name="retryAfterSeconds"/> to how long the client must wait.
    /// </summary>
    public bool TryAcquire(int userId, string scope, out int retryAfterSeconds)
    {
        var key = $"{userId}:{NormalizeScope(scope)}";
        var now = DateTime.UtcNow;
        lock (_gate)
        {
            if (_lastRefreshUtc.TryGetValue(key, out var last))
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

            _lastRefreshUtc[key] = now;
            retryAfterSeconds = 0;
            return true;
        }
    }

    private static string NormalizeScope(string? scope) =>
        string.Equals(scope, "shared", StringComparison.OrdinalIgnoreCase) ? "shared" : "mine";
}
