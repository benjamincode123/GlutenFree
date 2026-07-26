namespace GlutenScanner.Api.Models;

public record RegisterRequest(string? Username, string? Password);

public record LoginRequest(string? Username, string? Password);

public record SetPublicUserRequest(bool? PublicUser);

public record SetProfileImageRequest(string? ImageBase64);

public record FavoriteProductRef(string Catalog, int Id);

public record SetFavoritesRequest(IReadOnlyList<FavoriteProductRef>? Favorites);

public record CreateProductListRequest(string? Name);

public record ShareProductListRequest(string? Username);

public record ProductListResponse(
    int Id,
    string Name,
    int OwnerId,
    string OwnerUsername,
    bool IsOwner,
    DateTime CreatedAt,
    IReadOnlyList<int> SharedUserIds,
    IReadOnlyList<string> SharedUsernames,
    IReadOnlyList<FavoriteProductRef> Products);

/// <summary>Public user info returned to clients (never includes the password hash).</summary>
public record UserResponse(
    int Id,
    string Username,
    int Level,
    int Xp,
    bool IsAdmin,
    bool PublicUser,
    string? ProfileImageBase64,
    IReadOnlyList<FavoriteProductRef> Favorites);

/// <summary>Returned after a successful register/login.</summary>
public record AuthResponse(string Token, DateTime ExpiresAt, UserResponse User);

public record XpHistoryItemResponse(
    int Id,
    int XpAmount,
    DateTime CreatedAt,
    string Reason,
    string? Detail);

public record XpProfileResponse(
    int Xp,
    int Level,
    int XpLevel,
    bool IsAdmin,
    int LevelMinXp,
    int LevelMaxXp,
    int XpIntoLevel,
    int XpForLevel,
    int XpToNextLevel,
    double Progress,
    IReadOnlyList<XpHistoryItemResponse> History);
