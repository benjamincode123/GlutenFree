namespace GlutenScanner.Api.Models;

/// <summary>Product shape returned to clients (serialized as camelCase JSON).</summary>
public record ProductResponse(
    int Id,
    string Barcode,
    string Name,
    string? Ingredients,
    string GlutenRating,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>Payload sent by the app when adding or updating a product.</summary>
public record NewProductRequest(
    string? Barcode,
    string? Name,
    string? Ingredients,
    string? GlutenRating);
