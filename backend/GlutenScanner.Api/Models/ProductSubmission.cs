namespace GlutenScanner.Api.Models;

/// <summary>
/// Product suggestion from a non-admin user. Not applied to the live catalog
/// until an admin reviews/approves it.
/// </summary>
public class ProductSubmission
{
    public int Id { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Ingredients { get; set; }
    public string GlutenRating { get; set; } = string.Empty;
    public string ImageBase64 { get; set; } = string.Empty;
    public int SubmittedByUserId { get; set; }
    public string Status { get; set; } = PendingStatus;
    public DateTime CreatedAt { get; set; }

    public const string PendingStatus = "pending";
    public const string ApprovedStatus = "approved";
    public const string DeniedStatus = "denied";
}