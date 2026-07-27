using GlutenScanner.Api.Models;
using GlutenScanner.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace GlutenScanner.Api.Data;

/// <summary>
/// Ensures app tables exist on a pre-provisioned Azure SQL database.
/// Idempotent and safe to run on every startup.
/// </summary>
public static class DbInitializer
{
    private const string DropLegacyProductsTableSql = @"
IF OBJECT_ID(N'[dbo].[products]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[products];
END";

    private const string CreateUsersTableSql = @"
IF OBJECT_ID(N'[dbo].[users]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[users] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [username] NVARCHAR(64) NOT NULL,
        [password_hash] NVARCHAR(512) NOT NULL,
        [level] INT NOT NULL CONSTRAINT [DF_users_level] DEFAULT (1),
        [xp] INT NOT NULL CONSTRAINT [DF_users_xp] DEFAULT (1),
        [public_user] BIT NOT NULL CONSTRAINT [DF_users_public_user] DEFAULT (0),
        [profile_image_base64] NVARCHAR(MAX) NULL,
        [favorites] NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_users_favorites] DEFAULT (N'[]'),
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_users_created_at] DEFAULT (SYSUTCDATETIME()),
        [updated_at] DATETIME2 NOT NULL CONSTRAINT [DF_users_updated_at] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_users] PRIMARY KEY ([id]),
        CONSTRAINT [UQ_users_username] UNIQUE ([username])
    );
END";

    private const string CreateSessionsTableSql = @"
IF OBJECT_ID(N'[dbo].[sessions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[sessions] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [user_id] INT NOT NULL,
        [token] NVARCHAR(128) NOT NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_sessions_created_at] DEFAULT (SYSUTCDATETIME()),
        [expires_at] DATETIME2 NOT NULL,
        CONSTRAINT [PK_sessions] PRIMARY KEY ([id]),
        CONSTRAINT [UQ_sessions_token] UNIQUE ([token]),
        CONSTRAINT [FK_sessions_users] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE
    );
END";

    private const string CreateProductSubmissionsTableSql = @"
IF OBJECT_ID(N'[dbo].[product_submissions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[product_submissions] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [barcode] NVARCHAR(64) NOT NULL,
        [produsent] NVARCHAR(256) NULL,
        [name] NVARCHAR(512) NOT NULL,
        [ingredients] NVARCHAR(MAX) NULL,
        [gluten_rating] NVARCHAR(32) NOT NULL,
        [image_base64] NVARCHAR(MAX) NOT NULL,
        [submitted_by_user_id] INT NOT NULL,
        [status] NVARCHAR(32) NOT NULL CONSTRAINT [DF_product_submissions_status] DEFAULT (N'pending'),
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_product_submissions_created_at] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_product_submissions] PRIMARY KEY ([id])
    );
    CREATE INDEX [IX_product_submissions_status] ON [dbo].[product_submissions]([status]);
END";

    private const string EnsureProductSubmissionsImageColumnSql = @"
IF OBJECT_ID(N'[dbo].[product_submissions]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.product_submissions', N'image_base64') IS NULL
BEGIN
    ALTER TABLE [dbo].[product_submissions] ADD [image_base64] NVARCHAR(MAX) NULL;
END
IF OBJECT_ID(N'[dbo].[product_submissions]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.product_submissions', N'image_base64') IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM sys.columns
     WHERE object_id = OBJECT_ID(N'dbo.product_submissions')
       AND name = N'image_base64'
       AND is_nullable = 1
   )
BEGIN
    EXEC(N'UPDATE [dbo].[product_submissions] SET [image_base64] = N'''' WHERE [image_base64] IS NULL');
    EXEC(N'ALTER TABLE [dbo].[product_submissions] ALTER COLUMN [image_base64] NVARCHAR(MAX) NOT NULL');
END";

    private const string EnsureProductSubmissionsProdusentColumnSql = @"
IF OBJECT_ID(N'[dbo].[product_submissions]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.product_submissions', N'produsent') IS NULL
BEGIN
    ALTER TABLE [dbo].[product_submissions] ADD [produsent] NVARCHAR(256) NULL;
END";

    private const string EnsureUsersXpColumnSql = @"
IF OBJECT_ID(N'[dbo].[users]', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.users', N'xp') IS NULL
BEGIN
    ALTER TABLE [dbo].[users] ADD [xp] INT NOT NULL
        CONSTRAINT [DF_users_xp] DEFAULT (1);
END";

    private const string EnsureUsersPublicUserColumnSql = @"
IF OBJECT_ID(N'[dbo].[users]', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.users', N'public_user') IS NULL
BEGIN
    ALTER TABLE [dbo].[users] ADD [public_user] BIT NOT NULL
        CONSTRAINT [DF_users_public_user] DEFAULT (0);
END";

    private const string EnsureUsersProfileImageColumnSql = @"
IF OBJECT_ID(N'[dbo].[users]', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.users', N'profile_image_base64') IS NULL
BEGIN
    ALTER TABLE [dbo].[users] ADD [profile_image_base64] NVARCHAR(MAX) NULL;
END";

    private const string EnsureUsersFavoritesColumnSql = @"
IF OBJECT_ID(N'[dbo].[users]', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.users', N'favorites') IS NULL
BEGIN
    ALTER TABLE [dbo].[users] ADD [favorites] NVARCHAR(MAX) NOT NULL
        CONSTRAINT [DF_users_favorites] DEFAULT (N'[]');
END";

    private const string CreateProductImageValidationsTableSql = @"
IF OBJECT_ID(N'[dbo].[product_image_validations]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[product_image_validations] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [catalog] NVARCHAR(16) NOT NULL,
        [product_id] INT NOT NULL,
        [product_name] NVARCHAR(512) NOT NULL,
        [image_base64] NVARCHAR(MAX) NOT NULL,
        [submitted_by_user_id] INT NOT NULL,
        [status] NVARCHAR(32) NOT NULL CONSTRAINT [DF_product_image_validations_status] DEFAULT (N'pending'),
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_product_image_validations_created_at] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_product_image_validations] PRIMARY KEY ([id]),
        CONSTRAINT [FK_product_image_validations_users] FOREIGN KEY ([submitted_by_user_id])
            REFERENCES [dbo].[users]([id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_product_image_validations_status] ON [dbo].[product_image_validations]([status]);
    CREATE INDEX [IX_product_image_validations_product] ON [dbo].[product_image_validations]([catalog], [product_id]);
END";

    private const string CreateXpProgressTableSql = @"
IF OBJECT_ID(N'[dbo].[xp_progress]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[xp_progress] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [user_id] INT NOT NULL,
        [xp_amount] INT NOT NULL,
        [barcode_report_id] INT NULL,
        [product_submission_id] INT NULL,
        [product_image_validation_id] INT NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_xp_progress_created_at] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_xp_progress] PRIMARY KEY ([id]),
        CONSTRAINT [FK_xp_progress_users] FOREIGN KEY ([user_id])
            REFERENCES [dbo].[users]([id]) ON DELETE CASCADE,
        CONSTRAINT [FK_xp_progress_product_submissions] FOREIGN KEY ([product_submission_id])
            REFERENCES [dbo].[product_submissions]([id]) ON DELETE SET NULL,
        CONSTRAINT [FK_xp_progress_barcode_reports] FOREIGN KEY ([barcode_report_id])
            REFERENCES [dbo].[barcode_reports]([id]) ON DELETE SET NULL,
        CONSTRAINT [FK_xp_progress_product_image_validations] FOREIGN KEY ([product_image_validation_id])
            REFERENCES [dbo].[product_image_validations]([id]) ON DELETE NO ACTION
    );
    CREATE INDEX [IX_xp_progress_user_id] ON [dbo].[xp_progress]([user_id]);
END";

    private const string EnsureXpProgressProductImageValidationColumnSql = @"
IF OBJECT_ID(N'[dbo].[xp_progress]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.xp_progress', N'product_image_validation_id') IS NULL
BEGIN
    ALTER TABLE [dbo].[xp_progress] ADD [product_image_validation_id] INT NULL;
END
IF OBJECT_ID(N'[dbo].[xp_progress]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.xp_progress', N'product_image_validation_id') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[product_image_validations]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[FK_xp_progress_product_image_validations]', N'F') IS NULL
BEGIN
    ALTER TABLE [dbo].[xp_progress] WITH CHECK ADD CONSTRAINT [FK_xp_progress_product_image_validations]
        FOREIGN KEY ([product_image_validation_id])
        REFERENCES [dbo].[product_image_validations]([id]) ON DELETE NO ACTION;
END";

    private const string CreateListsTableSql = @"
IF OBJECT_ID(N'[dbo].[lists]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[lists] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [owner_id] INT NOT NULL,
        [name] NVARCHAR(128) NOT NULL CONSTRAINT [DF_lists_name] DEFAULT (N'Liste'),
        [shared_user_ids] NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_lists_shared_user_ids] DEFAULT (N'[]'),
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_lists_created_at] DEFAULT (SYSUTCDATETIME()),
        [product_ids] NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_lists_product_ids] DEFAULT (N'[]'),
        CONSTRAINT [PK_lists] PRIMARY KEY ([id]),
        CONSTRAINT [FK_lists_owner] FOREIGN KEY ([owner_id])
            REFERENCES [dbo].[users]([id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_lists_owner_id] ON [dbo].[lists]([owner_id]);
END";

    private const string EnsureListsNameColumnSql = @"
IF OBJECT_ID(N'[dbo].[lists]', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.lists', N'name') IS NULL
BEGIN
    ALTER TABLE [dbo].[lists] ADD [name] NVARCHAR(128) NOT NULL
        CONSTRAINT [DF_lists_name] DEFAULT (N'Liste');
END";

    public static async Task InitializeAsync(AppDbContext db, CancellationToken cancellationToken = default)
    {
        await db.Database.ExecuteSqlRawAsync(DropLegacyProductsTableSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(CreateUsersTableSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(EnsureUsersXpColumnSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(EnsureUsersPublicUserColumnSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(EnsureUsersProfileImageColumnSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(EnsureUsersFavoritesColumnSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(CreateSessionsTableSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(CreateProductSubmissionsTableSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(EnsureProductSubmissionsImageColumnSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(EnsureProductSubmissionsProdusentColumnSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(CreateProductImageValidationsTableSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(CreateListsTableSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(EnsureListsNameColumnSql, cancellationToken);
        await EnsureSeedUsersAsync(db, cancellationToken);
    }

    /// <summary>
    /// Creates xp_progress after catalog tables exist (needs barcode_reports FK).
    /// </summary>
    public static async Task EnsureXpProgressTableAsync(
        AppDbContext db,
        CancellationToken cancellationToken = default)
    {
        await db.Database.ExecuteSqlRawAsync(CreateXpProgressTableSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(EnsureXpProgressProductImageValidationColumnSql, cancellationToken);
    }

    private static async Task EnsureSeedUsersAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        await EnsureSeedUserAsync(db, "Amalie", "test123", level: 1, cancellationToken);
        await EnsureSeedUserAsync(db, "testuser", "test123", level: 99, cancellationToken);
    }

    private static async Task EnsureSeedUserAsync(
        AppDbContext db,
        string username,
        string password,
        int level,
        CancellationToken cancellationToken)
    {
        var exists = await db.Users.AnyAsync(u => u.Username == username, cancellationToken);
        if (exists)
        {
            return;
        }

        var now = DateTime.UtcNow;
        db.Users.Add(new User
        {
            Username = username,
            PasswordHash = PasswordHasher.Hash(password),
            Level = level,
            Xp = 1,
            PublicUser = false,
            CreatedAt = now,
            UpdatedAt = now,
        });
        await db.SaveChangesAsync(cancellationToken);
    }
}
