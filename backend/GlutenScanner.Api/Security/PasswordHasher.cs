using System.Security.Cryptography;

namespace GlutenScanner.Api.Security;

/// <summary>
/// Hashes and verifies passwords using PBKDF2 (HMAC-SHA256) with a random
/// per-password salt. Stored format: "pbkdf2.{iterations}.{saltBase64}.{hashBase64}".
/// Uses only the built-in .NET cryptography APIs.
/// </summary>
public static class PasswordHasher
{
    private const int SaltSize = 16;       // 128-bit salt
    private const int KeySize = 32;        // 256-bit derived key
    private const int Iterations = 100_000;
    private static readonly HashAlgorithmName Algorithm = HashAlgorithmName.SHA256;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, Algorithm, KeySize);
        return $"pbkdf2.{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string stored)
    {
        var parts = stored.Split('.');
        if (parts.Length != 4 || parts[0] != "pbkdf2")
        {
            return false;
        }
        if (!int.TryParse(parts[1], out var iterations))
        {
            return false;
        }

        byte[] salt;
        byte[] expected;
        try
        {
            salt = Convert.FromBase64String(parts[2]);
            expected = Convert.FromBase64String(parts[3]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, Algorithm, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
