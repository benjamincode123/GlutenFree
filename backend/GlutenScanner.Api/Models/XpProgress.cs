namespace GlutenScanner.Api.Models;

/// <summary>
/// A single XP credit awarded when a user's barcode report or product
/// submission is applied to the live gluten / glutenfri catalog.
/// </summary>
public class XpProgress
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int XpAmount { get; set; }

    /// <summary>Set when the credit came from an applied barcode report.</summary>
    public int? BarcodeReportId { get; set; }

    /// <summary>Set when the credit came from an applied product submission.</summary>
    public int? ProductSubmissionId { get; set; }

    public DateTime CreatedAt { get; set; }

    public User? User { get; set; }
    public ProductSubmission? ProductSubmission { get; set; }
}
