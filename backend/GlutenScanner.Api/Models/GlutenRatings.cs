namespace GlutenScanner.Api.Models;

/// <summary>
/// Allowed gluten rating values. These string values are shared with the mobile
/// app and stored verbatim in the database.
/// </summary>
public static class GlutenRatings
{
    public const string GlutenFree = "gluten_free";
    public const string GlutenTrace = "gluten_trace";
    public const string GlutenContent = "gluten_content";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        GlutenFree,
        GlutenTrace,
        GlutenContent,
    };

    public static bool IsValid(string? value) => value is not null && All.Contains(value);
}
