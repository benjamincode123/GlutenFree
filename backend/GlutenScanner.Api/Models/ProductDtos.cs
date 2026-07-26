namespace GlutenScanner.Api.Models;

/// <summary>Product shape returned to clients (serialized as camelCase JSON).</summary>
public record ProductResponse(
    int Id,
    string Barcode,
    string Name,
    string? Ingredients,
    string GlutenRating,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    /// <summary>Which catalog table: glutenfri or gluten. Use "pending" for submissions.</summary>
    string Catalog,
    /// <summary>True when the product was queued for admin review and not applied yet.</summary>
    bool Pending = false,
    /// <summary>Optional product image encoded as base64.</summary>
    string? ImageBase64 = null);

/// <summary>Payload sent by the app when adding or updating a product.</summary>
public record NewProductRequest(
    string? Barcode,
    string? Name,
    string? Ingredients,
    string? GlutenRating,
    string? ImageBase64);

/// <summary>User-submitted barcode for a product that currently has barcode=unknown.</summary>
public record ReportBarcodeRequest(string? Barcode, string? ImageBase64);

public record ProductSubmissionResponse(
    int Id,
    string Barcode,
    string Name,
    string? Ingredients,
    string GlutenRating,
    string ImageBase64,
    int SubmittedByUserId,
    string? SubmittedByUsername,
    string Status,
    DateTime CreatedAt);

public record ProductSubmissionListResponse(
    IReadOnlyList<ProductSubmissionResponse> Items,
    int Page,
    int PageSize,
    int TotalCount);

/// <summary>Optional overrides an admin can apply when approving a submission.</summary>
public record ApproveProductSubmissionRequest(
    string? Barcode,
    string? Name,
    string? Ingredients,
    string? GlutenRating);
