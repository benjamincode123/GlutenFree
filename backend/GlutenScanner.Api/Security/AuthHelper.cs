using System.Security.Cryptography;
using GlutenScanner.Api.Data;
using GlutenScanner.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GlutenScanner.Api.Security;

/// <summary>
/// Helpers for issuing and validating session tokens.
/// </summary>
public static class AuthHelper
{
    /// <summary>How long a session is valid after login.</summary>
    public static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(30);

    /// <summary>Generates a URL-safe random session token.</summary>
    public static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    /// <summary>Reads the Bearer token from the Authorization header, if present.</summary>
    public static string? ExtractToken(HttpContext ctx)
    {
        var header = ctx.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(header))
        {
            return null;
        }

        const string prefix = "Bearer ";
        return header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? header[prefix.Length..].Trim()
            : header.Trim();
    }

    /// <summary>
    /// Resolves the authenticated user from the request's Bearer token, or null
    /// if there is no valid, unexpired session.
    /// </summary>
    public static async Task<User?> ResolveUserAsync(HttpContext ctx, AppDbContext db)
    {
        var token = ExtractToken(ctx);
        if (string.IsNullOrEmpty(token))
        {
            return null;
        }

        var session = await db.Sessions
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.Token == token);

        if (session is null || session.ExpiresAt < DateTime.UtcNow)
        {
            return null;
        }

        return session.User;
    }
}
