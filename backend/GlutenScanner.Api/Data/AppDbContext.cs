using GlutenScanner.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GlutenScanner.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserSession> Sessions => Set<UserSession>();
    public DbSet<ProductSubmission> ProductSubmissions => Set<ProductSubmission>();
    public DbSet<XpProgress> XpProgress => Set<XpProgress>();
    public DbSet<ProductList> Lists => Set<ProductList>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var product = modelBuilder.Entity<Product>();
        product.ToTable("products");
        product.HasKey(p => p.Id);
        product.Property(p => p.Id).HasColumnName("id").ValueGeneratedOnAdd();
        product.Property(p => p.Barcode).HasColumnName("barcode").HasMaxLength(64).IsRequired();
        product.HasIndex(p => p.Barcode).IsUnique();
        product.Property(p => p.Name).HasColumnName("name").HasMaxLength(256).IsRequired();
        product.Property(p => p.Ingredients).HasColumnName("ingredients");
        product.Property(p => p.GlutenRating).HasColumnName("gluten_rating").HasMaxLength(32).IsRequired();
        product.Property(p => p.CreatedAt).HasColumnName("created_at");
        product.Property(p => p.UpdatedAt).HasColumnName("updated_at");

        var user = modelBuilder.Entity<User>();
        user.ToTable("users");
        user.Ignore(u => u.IsAdmin);
        user.HasKey(u => u.Id);
        user.Property(u => u.Id).HasColumnName("id").ValueGeneratedOnAdd();
        user.Property(u => u.Username).HasColumnName("username").HasMaxLength(64).IsRequired();
        user.HasIndex(u => u.Username).IsUnique();
        user.Property(u => u.PasswordHash).HasColumnName("password_hash").HasMaxLength(512).IsRequired();
        user.Property(u => u.Level).HasColumnName("level").HasDefaultValue(1);
        user.Property(u => u.Xp).HasColumnName("xp").HasDefaultValue(1);
        user.Property(u => u.PublicUser).HasColumnName("public_user").HasDefaultValue(false);
        user.Property(u => u.ProfileImageBase64).HasColumnName("profile_image_base64");
        user.Property(u => u.FavoritesJson).HasColumnName("favorites").HasDefaultValue("[]");
        user.Property(u => u.CreatedAt).HasColumnName("created_at");
        user.Property(u => u.UpdatedAt).HasColumnName("updated_at");

        var session = modelBuilder.Entity<UserSession>();
        session.ToTable("sessions");
        session.HasKey(s => s.Id);
        session.Property(s => s.Id).HasColumnName("id").ValueGeneratedOnAdd();
        session.Property(s => s.UserId).HasColumnName("user_id");
        session.Property(s => s.Token).HasColumnName("token").HasMaxLength(128).IsRequired();
        session.HasIndex(s => s.Token).IsUnique();
        session.Property(s => s.CreatedAt).HasColumnName("created_at");
        session.Property(s => s.ExpiresAt).HasColumnName("expires_at");
        session.HasOne(s => s.User)
            .WithMany(u => u.Sessions)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        var submission = modelBuilder.Entity<ProductSubmission>();
        submission.ToTable("product_submissions");
        submission.HasKey(s => s.Id);
        submission.Property(s => s.Id).HasColumnName("id").ValueGeneratedOnAdd();
        submission.Property(s => s.Barcode).HasColumnName("barcode").HasMaxLength(64).IsRequired();
        submission.Property(s => s.Name).HasColumnName("name").HasMaxLength(512).IsRequired();
        submission.Property(s => s.Ingredients).HasColumnName("ingredients");
        submission.Property(s => s.GlutenRating).HasColumnName("gluten_rating").HasMaxLength(32).IsRequired();
        submission.Property(s => s.ImageBase64).HasColumnName("image_base64").IsRequired();
        submission.Property(s => s.SubmittedByUserId).HasColumnName("submitted_by_user_id");
        submission.Property(s => s.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
        submission.Property(s => s.CreatedAt).HasColumnName("created_at");
        submission.HasIndex(s => s.Status);

        var xp = modelBuilder.Entity<XpProgress>();
        xp.ToTable("xp_progress");
        xp.HasKey(x => x.Id);
        xp.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();
        xp.Property(x => x.UserId).HasColumnName("user_id");
        xp.Property(x => x.XpAmount).HasColumnName("xp_amount");
        xp.Property(x => x.BarcodeReportId).HasColumnName("barcode_report_id");
        xp.Property(x => x.ProductSubmissionId).HasColumnName("product_submission_id");
        xp.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("SYSUTCDATETIME()");
        xp.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        xp.HasOne(x => x.ProductSubmission)
            .WithMany()
            .HasForeignKey(x => x.ProductSubmissionId)
            .OnDelete(DeleteBehavior.SetNull);
        xp.HasIndex(x => x.UserId);

        var list = modelBuilder.Entity<ProductList>();
        list.ToTable("lists");
        list.HasKey(l => l.Id);
        list.Property(l => l.Id).HasColumnName("id").ValueGeneratedOnAdd();
        list.Property(l => l.OwnerId).HasColumnName("owner_id");
        list.Property(l => l.Name).HasColumnName("name").HasMaxLength(128).IsRequired();
        list.Property(l => l.SharedUserIdsJson).HasColumnName("shared_user_ids").HasDefaultValue("[]");
        list.Property(l => l.CreatedAt).HasColumnName("created_at");
        list.Property(l => l.ProductIdsJson).HasColumnName("product_ids").HasDefaultValue("[]");
        list.HasOne(l => l.Owner)
            .WithMany()
            .HasForeignKey(l => l.OwnerId)
            .OnDelete(DeleteBehavior.Cascade);
        list.HasIndex(l => l.OwnerId);
    }
}
