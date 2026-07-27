using Microsoft.EntityFrameworkCore;

namespace GlutenScanner.Api.Data;

public class GlutenFriItem
{
    public int Id { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string? Produsent { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Optional product image as a base64 string (may include data-URI prefix).</summary>
    public string? ImageBase64 { get; set; }
    /// <summary>Ingredient list text from the catalog source, when available.</summary>
    public string? Ingredients { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class GlutenItem
{
    public int Id { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string? Produsent { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Optional product image as a base64 string (may include data-URI prefix).</summary>
    public string? ImageBase64 { get; set; }
    /// <summary>Ingredient list text from the catalog source, when available.</summary>
    public string? Ingredients { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class BarcodeReport
{
    public int Id { get; set; }
    public string Catalog { get; set; } = string.Empty;
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string SuggestedBarcode { get; set; } = string.Empty;
    /// <summary>Optional photo of the product, base64 / data-URI.</summary>
    public string? ImageBase64 { get; set; }
    public int? ReportedByUserId { get; set; }
    public bool Applied { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Catalog tables in GlutenFridb: dbo.glutenfri and dbo.gluten.</summary>
public class MenyCatalogDbContext : DbContext
{
    public const string CatalogFri = "glutenfri";
    public const string CatalogGluten = "gluten";
    public const string UnknownBarcode = "unknown";

    public MenyCatalogDbContext(DbContextOptions<MenyCatalogDbContext> options) : base(options)
    {
    }

    public DbSet<GlutenFriItem> GlutenFriProducts => Set<GlutenFriItem>();
    public DbSet<GlutenItem> GlutenProducts => Set<GlutenItem>();
    public DbSet<BarcodeReport> BarcodeReports => Set<BarcodeReport>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var fri = modelBuilder.Entity<GlutenFriItem>();
        fri.ToTable("glutenfri");
        fri.HasKey(p => p.Id);
        fri.Property(p => p.Id).HasColumnName("id").ValueGeneratedOnAdd();
        fri.Property(p => p.Barcode).HasColumnName("barcode").HasMaxLength(64).IsRequired();
        fri.Property(p => p.Produsent).HasColumnName("produsent").HasMaxLength(256);
        fri.Property(p => p.Name).HasColumnName("name").HasMaxLength(512).IsRequired();
        fri.Property(p => p.ImageBase64).HasColumnName("image_base64");
        fri.Property(p => p.Ingredients).HasColumnName("ingredients");
        fri.Property(p => p.CreatedAt).HasColumnName("created_at");

        var gluten = modelBuilder.Entity<GlutenItem>();
        gluten.ToTable("gluten");
        gluten.HasKey(p => p.Id);
        gluten.Property(p => p.Id).HasColumnName("id").ValueGeneratedOnAdd();
        gluten.Property(p => p.Barcode).HasColumnName("barcode").HasMaxLength(64).IsRequired();
        gluten.Property(p => p.Produsent).HasColumnName("produsent").HasMaxLength(256);
        gluten.Property(p => p.Name).HasColumnName("name").HasMaxLength(512).IsRequired();
        gluten.Property(p => p.ImageBase64).HasColumnName("image_base64");
        gluten.Property(p => p.Ingredients).HasColumnName("ingredients");
        gluten.Property(p => p.CreatedAt).HasColumnName("created_at");

        var report = modelBuilder.Entity<BarcodeReport>();
        report.ToTable("barcode_reports");
        report.HasKey(r => r.Id);
        report.Property(r => r.Id).HasColumnName("id").ValueGeneratedOnAdd();
        report.Property(r => r.Catalog).HasColumnName("catalog").HasMaxLength(16).IsRequired();
        report.Property(r => r.ProductId).HasColumnName("product_id");
        report.Property(r => r.ProductName).HasColumnName("product_name").HasMaxLength(512).IsRequired();
        report.Property(r => r.SuggestedBarcode).HasColumnName("suggested_barcode").HasMaxLength(64).IsRequired();
        report.Property(r => r.ImageBase64).HasColumnName("image_base64");
        report.Property(r => r.ReportedByUserId).HasColumnName("reported_by_user_id");
        report.Property(r => r.Applied).HasColumnName("applied");
        report.Property(r => r.CreatedAt).HasColumnName("created_at");
    }
}
