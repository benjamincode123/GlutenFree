namespace GlutenScanner.Api.Models;

/// <summary>
/// A login session. The <see cref="Token"/> is a random secret handed to the
/// client, which sends it back as a Bearer token to authenticate requests.
/// Maps to the [sessions] table.
/// </summary>
public class UserSession
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Token { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}
