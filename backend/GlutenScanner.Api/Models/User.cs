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

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<UserSession> Sessions { get; set; } = new();

    public bool IsAdmin => Level >= AdminLevel;

    public const int AdminLevel = 100;
}
