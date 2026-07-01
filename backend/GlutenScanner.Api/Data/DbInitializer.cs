using Microsoft.EntityFrameworkCore;

namespace GlutenScanner.Api.Data;

/// <summary>
/// Creates the products table if it does not already exist. This is idempotent
/// and safe to run on every startup, which suits a pre-provisioned Azure SQL
/// database where we only need to guarantee the table is present.
/// </summary>
public static class DbInitializer
{
    private const string CreateProductsTableSql = @"
IF OBJECT_ID(N'[dbo].[products]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[products] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [barcode] NVARCHAR(64) NOT NULL,
        [name] NVARCHAR(256) NOT NULL,
        [ingredients] NVARCHAR(MAX) NULL,
        [gluten_rating] NVARCHAR(32) NOT NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_products_created_at] DEFAULT (SYSUTCDATETIME()),
        [updated_at] DATETIME2 NOT NULL CONSTRAINT [DF_products_updated_at] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_products] PRIMARY KEY ([id]),
        CONSTRAINT [UQ_products_barcode] UNIQUE ([barcode]),
        CONSTRAINT [CK_products_gluten_rating] CHECK ([gluten_rating] IN ('gluten_free', 'gluten_trace', 'gluten_content'))
    );
END";

    private const string CreateUsersTableSql = @"
IF OBJECT_ID(N'[dbo].[users]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[users] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [username] NVARCHAR(64) NOT NULL,
        [password_hash] NVARCHAR(512) NOT NULL,
        [level] INT NOT NULL CONSTRAINT [DF_users_level] DEFAULT (1),
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

    public static async Task InitializeAsync(AppDbContext db, CancellationToken cancellationToken = default)
    {
        await db.Database.ExecuteSqlRawAsync(CreateProductsTableSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(CreateUsersTableSql, cancellationToken);
        await db.Database.ExecuteSqlRawAsync(CreateSessionsTableSql, cancellationToken);
    }
}
