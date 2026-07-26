namespace GlutenScanner.Api.Models;

/// <summary>
/// A shareable product list owned by one user. Maps to the [lists] table.
/// Shared users and products are stored as JSON arrays.
/// </summary>
public class ProductList
{
    public int Id { get; set; }

    /// <summary>User that owns / created the list.</summary>
    public int OwnerId { get; set; }

    /// <summary>Display name chosen by the owner.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// JSON array of user ids that can access the list, e.g. [2,5,9].
    /// </summary>
    public string SharedUserIdsJson { get; set; } = "[]";

    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// JSON array of catalog product refs, same shape as user favorites:
    /// [{"catalog":"glutenfri","id":12},{"catalog":"gluten","id":34}].
    /// </summary>
    public string ProductIdsJson { get; set; } = "[]";

    public User? Owner { get; set; }
}
