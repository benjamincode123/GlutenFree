using GlutenScanner.Api.Data;
using GlutenScanner.Api.Models;
using GlutenScanner.Api.Security;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Missing connection string 'ConnectionStrings:Default'. Provide your Azure SQL " +
        "connection string via user-secrets, the ConnectionStrings__Default environment " +
        "variable, or appsettings.Development.json. See backend/README.md.");
}

builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));

const string DevCorsPolicy = "DevCors";
builder.Services.AddCors(options =>
{
    // Permissive policy for local development so the Expo app (on a device or
    // simulator, from any LAN address) can call the API. Tighten this before
    // any real deployment.
    options.AddPolicy(DevCorsPolicy, policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

app.UseCors(DevCorsPolicy);

// Make sure the products table exists (idempotent).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DbInitializer.InitializeAsync(db);
}

app.MapGet("/", () => Results.Ok(new { service = "GlutenScanner.Api", status = "ok" }));

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------
var auth = app.MapGroup("/api/auth");

auth.MapPost("/register", async (RegisterRequest request, AppDbContext db) =>
{
    var username = request.Username?.Trim();
    var password = request.Password ?? string.Empty;

    if (string.IsNullOrEmpty(username) || username.Length < 3)
    {
        return Results.BadRequest(new { error = "Username must be at least 3 characters." });
    }
    if (password.Length < 6)
    {
        return Results.BadRequest(new { error = "Password must be at least 6 characters." });
    }

    var exists = await db.Users.AnyAsync(u => u.Username == username);
    if (exists)
    {
        return Results.Conflict(new { error = "That username is already taken." });
    }

    var now = DateTime.UtcNow;
    var user = new User
    {
        Username = username,
        PasswordHash = PasswordHasher.Hash(password),
        Level = 1,
        CreatedAt = now,
        UpdatedAt = now,
    };
    db.Users.Add(user);
    await db.SaveChangesAsync();

    var authResult = await CreateSessionAsync(db, user);
    return Results.Created("/api/auth/me", authResult);
});

auth.MapPost("/login", async (LoginRequest request, AppDbContext db) =>
{
    var username = request.Username?.Trim();
    var password = request.Password ?? string.Empty;

    if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
    {
        return Results.BadRequest(new { error = "Username and password are required." });
    }

    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user is null || !PasswordHasher.Verify(password, user.PasswordHash))
    {
        return Results.Json(new { error = "Invalid username or password." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var authResult = await CreateSessionAsync(db, user);
    return Results.Ok(authResult);
});

auth.MapPost("/logout", async (HttpContext ctx, AppDbContext db) =>
{
    var token = AuthHelper.ExtractToken(ctx);
    if (!string.IsNullOrEmpty(token))
    {
        await db.Sessions.Where(s => s.Token == token).ExecuteDeleteAsync();
    }
    return Results.NoContent();
});

auth.MapGet("/me", async (HttpContext ctx, AppDbContext db) =>
{
    var user = await AuthHelper.ResolveUserAsync(ctx, db);
    return user is null ? Results.Unauthorized() : Results.Ok(ToUserResponse(user));
});

// ---------------------------------------------------------------------------
// Product endpoints
// ---------------------------------------------------------------------------
var products = app.MapGroup("/api/products");

products.MapGet("/", async (AppDbContext db) =>
{
    var items = await db.Products
        .OrderByDescending(p => p.UpdatedAt)
        .ThenByDescending(p => p.Id)
        .ToListAsync();
    return Results.Ok(items.Select(ToResponse));
});

products.MapGet("/{barcode}", async (string barcode, AppDbContext db) =>
{
    var trimmed = barcode.Trim();
    var product = await db.Products.FirstOrDefaultAsync(p => p.Barcode == trimmed);
    return product is null ? Results.NotFound() : Results.Ok(ToResponse(product));
});

products.MapPost("/", async (NewProductRequest request, AppDbContext db) =>
{
    var barcode = request.Barcode?.Trim();
    var name = request.Name?.Trim();
    var ingredients = string.IsNullOrWhiteSpace(request.Ingredients) ? null : request.Ingredients!.Trim();
    var rating = request.GlutenRating?.Trim();

    if (string.IsNullOrEmpty(barcode))
    {
        return Results.BadRequest(new { error = "Barcode is required." });
    }
    if (string.IsNullOrEmpty(name))
    {
        return Results.BadRequest(new { error = "Product name is required." });
    }
    if (!GlutenRatings.IsValid(rating))
    {
        return Results.BadRequest(new
        {
            error = "gluten_rating must be one of: gluten_free, gluten_trace, gluten_content.",
        });
    }

    var now = DateTime.UtcNow;
    var existing = await db.Products.FirstOrDefaultAsync(p => p.Barcode == barcode);

    if (existing is null)
    {
        var product = new Product
        {
            Barcode = barcode,
            Name = name,
            Ingredients = ingredients,
            GlutenRating = rating!,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return Results.Created($"/api/products/{product.Barcode}", ToResponse(product));
    }

    existing.Name = name;
    existing.Ingredients = ingredients;
    existing.GlutenRating = rating!;
    existing.UpdatedAt = now;
    await db.SaveChangesAsync();
    return Results.Ok(ToResponse(existing));
})
.AddEndpointFilter(async (context, next) =>
{
    // Only admins (level >= 100) may add or edit products.
    var http = context.HttpContext;
    var db = http.RequestServices.GetRequiredService<AppDbContext>();
    var user = await AuthHelper.ResolveUserAsync(http, db);

    if (user is null)
    {
        return Results.Json(new { error = "You must be logged in." }, statusCode: StatusCodes.Status401Unauthorized);
    }
    if (!user.IsAdmin)
    {
        return Results.Json(new { error = "Admin access is required to add products." }, statusCode: StatusCodes.Status403Forbidden);
    }

    return await next(context);
});

app.Run();

static ProductResponse ToResponse(Product p) =>
    new(p.Id, p.Barcode, p.Name, p.Ingredients, p.GlutenRating, p.CreatedAt, p.UpdatedAt);

static UserResponse ToUserResponse(User u) =>
    new(u.Id, u.Username, u.Level, u.IsAdmin);

static async Task<AuthResponse> CreateSessionAsync(AppDbContext db, User user)
{
    var now = DateTime.UtcNow;
    var session = new UserSession
    {
        UserId = user.Id,
        Token = AuthHelper.GenerateToken(),
        CreatedAt = now,
        ExpiresAt = now.Add(AuthHelper.SessionLifetime),
    };
    db.Sessions.Add(session);
    await db.SaveChangesAsync();
    return new AuthResponse(session.Token, session.ExpiresAt, ToUserResponse(user));
}
