namespace GlutenScanner.Api.Models;

/// <summary>
/// User-submitted product photo awaiting admin validation before it is
/// written to the live catalog (glutenfri / gluten).
/// </summary>
public class ProductImageValidation
{
    public int Id { get; set; }
    public string Catalog { get; set; } = string.Empty;
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string ImageBase64 { get; set; } = string.Empty;
    public int SubmittedByUserId { get; set; }
    public string Status { get; set; } = PendingStatus;
    public DateTime CreatedAt { get; set; }

    public const string PendingStatus = "pending";
    public const string ApprovedStatus = "approved";
    public const string DeniedStatus = "denied";
}
