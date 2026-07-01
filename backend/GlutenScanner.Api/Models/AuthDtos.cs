namespace GlutenScanner.Api.Models;

public record RegisterRequest(string? Username, string? Password);

public record LoginRequest(string? Username, string? Password);

/// <summary>Public user info returned to clients (never includes the password hash).</summary>
public record UserResponse(int Id, string Username, int Level, bool IsAdmin);

/// <summary>Returned after a successful register/login.</summary>
public record AuthResponse(string Token, DateTime ExpiresAt, UserResponse User);
