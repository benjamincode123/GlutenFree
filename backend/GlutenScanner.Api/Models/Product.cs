namespace GlutenScanner.Api.Models;

/// <summary>
/// A scanned grocery product and its gluten rating. Maps to the [products]
/// table in SQL Server.
/// </summary>
public class Product
{
    public int Id { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Ingredients { get; set; }
    public string GlutenRating { get; set; } = GlutenRatings.GlutenFree;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
