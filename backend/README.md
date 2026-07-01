# Gluten Scanner API (.NET 10)

A minimal ASP.NET Core Web API backend for the Gluten Scanner app. It stores
products in **Azure SQL Server** and exposes a small REST API that the mobile app
calls through its `MssqlApiProductRepository`.

## Endpoints

### Products

| Method | Route                     | Auth        | Description                                  |
| ------ | ------------------------- | ----------- | -------------------------------------------- |
| GET    | `/`                       | none        | Health check                                 |
| GET    | `/api/products`           | none        | List all products (most recently updated first) |
| GET    | `/api/products/{barcode}` | none        | Get one product by barcode (404 if missing)  |
| POST   | `/api/products`           | admin only  | Add or update a product (upsert by barcode)  |

`POST` body (camelCase JSON):

```json
{
  "barcode": "5701234567890",
  "name": "Schar Gluten Free Bread",
  "ingredients": "Water, corn starch, ...",
  "glutenRating": "gluten_free"
}
```

`glutenRating` must be one of `gluten_free`, `gluten_trace`, `gluten_content`.

Adding/editing products requires an admin (see Authentication). Send the session
token as `Authorization: Bearer <token>`. Non-admins get `403`, anonymous callers
get `401`.

### Authentication

| Method | Route                | Auth   | Description                                   |
| ------ | -------------------- | ------ | --------------------------------------------- |
| POST   | `/api/auth/register` | none   | Create a user (level 1) and return a session  |
| POST   | `/api/auth/login`    | none   | Log in and return a session                   |
| POST   | `/api/auth/logout`   | bearer | Invalidate the current session token          |
| GET    | `/api/auth/me`       | bearer | Return the current user                       |

Register/login body:

```json
{ "username": "alice", "password": "secret123" }
```

Response (register/login):

```json
{
  "token": "<session token>",
  "expiresAt": "2026-08-01T12:00:00Z",
  "user": { "id": 1, "username": "alice", "level": 1, "isAdmin": false }
}
```

- Passwords are hashed with PBKDF2 (HMAC-SHA256, 100k iterations, per-user salt)
  in `Security/PasswordHasher.cs` - plain text passwords are never stored.
- Sessions live in the `sessions` table and are valid for 30 days.
- Username must be >= 3 chars; password must be >= 6 chars.

### User levels / making an admin

Every new user is **level 1** (standard). A user with **level 100 or higher is an
admin** and may add/edit products. There is no admin UI to promote users, so run
this SQL against the `GlutenFree` database:

```sql
UPDATE users SET level = 100 WHERE username = 'your-username';
```

The change takes effect on the user's next login (or next `/api/auth/me` call).

## Configuration: Azure SQL connection string

The connection string is **not committed**. Provide it in one of these ways
(user-secrets recommended for local development):

### Option 1 - user-secrets (recommended)

```bash
cd backend/GlutenScanner.Api
dotnet user-secrets set "ConnectionStrings:Default" "Server=tcp:<your-server>.database.windows.net,1433;Initial Catalog=<your-db>;User ID=<user>;Password=<password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
```

You can copy the exact ADO.NET connection string from the Azure Portal:
your SQL database -> **Connection strings** -> **ADO.NET**, then fill in the password.

### Option 2 - environment variable

```bash
# PowerShell
$env:ConnectionStrings__Default = "Server=tcp:...;"
```

### Option 3 - appsettings.Development.json (gitignored)

```json
{
  "ConnectionStrings": {
    "Default": "Server=tcp:...;"
  }
}
```

If no connection string is found, the API fails fast on startup with a clear
message.

> Azure note: make sure your machine's IP is allowed under the SQL server's
> **Networking / firewall** rules, otherwise connections will be refused.

## Run

```bash
cd backend/GlutenScanner.Api
dotnet run
```

By default it listens on `http://0.0.0.0:5178` (see `Properties/launchSettings.json`),
so it is reachable from a phone on the same network at `http://<your-computer-ip>:5178`.

On first run the API ensures the `products` table exists (idempotent
`CREATE TABLE IF NOT EXISTS` logic in `Data/DbInitializer.cs`), so a freshly
provisioned Azure database works without manual setup.

## Point the app at this API

In the mobile app, set the API base URL via an environment variable when starting Expo:

```bash
# from the repo root
$env:EXPO_PUBLIC_API_URL = "http://<your-computer-ip>:5178"
npm run start
```

See the app config in `src/config.ts`.

## Project layout

```
backend/GlutenScanner.Api/
  Program.cs              Endpoints (products + auth), DI, CORS, admin gate, startup table creation
  Data/
    AppDbContext.cs       EF Core context (products, users, sessions)
    DbInitializer.cs      Idempotent table creation
  Models/
    Product.cs            Product entity
    ProductDtos.cs        Product request/response records
    GlutenRatings.cs      Allowed rating values + validation
    User.cs               User entity (level 100+ = admin)
    UserSession.cs        Session entity
    AuthDtos.cs           Auth request/response records
  Security/
    PasswordHasher.cs     PBKDF2 password hashing + verification
    AuthHelper.cs         Token generation + Bearer-token user resolution
  appsettings.json        Config (connection string)
  GlutenScanner.Api.http  Sample requests for testing
```

## Security note

CORS is wide open (`AllowAnyOrigin`) for local development convenience. Restrict
it, and add authentication, before deploying anywhere public.
