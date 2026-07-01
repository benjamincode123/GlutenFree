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
    }
}
