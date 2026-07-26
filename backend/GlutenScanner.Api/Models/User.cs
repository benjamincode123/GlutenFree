namespace GlutenScanner.Api.Models;

/// <summary>
/// An application user. Maps to the [users] table. Passwords are never stored in
/// plain text - only a PBKDF2 hash is persisted in <see cref="PasswordHash"/>.
/// </summary>
public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>
    /// Privilege level. 1 by default. A level of 100 or higher is an admin and
    /// may add/edit products.
    /// </summary>
    public int Level { get; set; } = 1;

    /// <summary>
    /// Experience points. Starts at 1 for every user.
    /// </summary>
    public int Xp { get; set; } = 1;

    /// <summary>
    /// When true, the username is shown on public leaderboards.
    /// When false, the user appears as anonymous.
    /// </summary>
    public bool PublicUser { get; set; }

    /// <summary>
    /// Optional profile photo as a data-URI / base64 string (max 5 MB decoded).
    /// </summary>
    public string? ProfileImageBase64 { get; set; }

    /// <summary>
    /// JSON array of favorite catalog products, e.g.
    /// [{"catalog":"glutenfri","id":12},{"catalog":"gluten","id":34}].
    /// </summary>
    public string FavoritesJson { get; set; } = "[]";

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<UserSession> Sessions { get; set; } = new();

    public bool IsAdmin => Level >= AdminLevel;

    public const int AdminLevel = 100;
}
