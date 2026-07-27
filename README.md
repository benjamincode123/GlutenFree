# Gluten Scanner

An iOS-first React Native (Expo) app for people with celiac disease. Scan a
grocery barcode, and the app tells you whether the product is **Gluten Free**,
**May Contain Traces**, or **Contains Gluten** based on a local database. Users
can also add products they scan.

## Features

- Barcode scanner (EAN-13/8, UPC-A/E, Code 128, QR) using the device camera.
- Live readout of the raw scanned barcode value on screen (for development).
- Product lookup in a local **SQLite** database.
- Three-level gluten rating with clear color coding:
  - **Gluten Free** (green) - confirmed gluten free.
  - **May Contain Traces** (amber) - made with or near gluten-containing foods.
  - **Contains Gluten** (red) - contains gluten.
- Add or edit products: when a scanned barcode is unknown, submit its barcode,
  name, ingredients/contents, and gluten rating so it is recognized next time.
- Manual barcode entry fallback (useful in the iOS Simulator, which has no camera).
- A dev "All products" screen to browse everything in the database.
- User accounts: register/login with a username and password (passwords are
  hashed on the server), persistent sessions, and logout.
- Roles: standard users (level 1) can scan and look up products; only admins
  (level 100) can add or edit products. See the
  [UtenGluten-Backend](https://github.com/benjamincode123/UtenGluten-Backend)
  repo for how to promote an admin.

## Tech stack

- [Expo](https://expo.dev/) (SDK 54, the version supported by the App Store Expo Go) + React Native + TypeScript
- [expo-router](https://docs.expo.dev/router/introduction/) for navigation
- [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera/) for barcode scanning
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for the local `.db` file

## Getting started

### Prerequisites

- Node.js 18+ (tested with Node 24)
- The [Expo Go](https://expo.dev/go) app on your iPhone, **or** an iOS dev build
  (dev builds require a Mac with Xcode)

### Install

```bash
npm install
```

### Run

```bash
npm run start
```

Then:

- **On a physical iPhone (recommended for scanning):** open the Camera app or
  Expo Go and scan the QR code shown in the terminal. Camera-based barcode
  scanning only works on a real device.
- **iOS Simulator:** press `i` in the Expo CLI. The Simulator has no camera, so
  use the **Manual entry** field on the scanner screen to test lookups.

## How it works

### Data model

Products are stored in a single SQLite table (`gluten.db`):

| Column          | Type    | Notes                                                        |
| --------------- | ------- | ------------------------------------------------------------ |
| `id`            | INTEGER | Primary key                                                  |
| `barcode`       | TEXT    | Unique                                                       |
| `name`          | TEXT    | Product name                                                 |
| `ingredients`   | TEXT    | Ingredients / contents (nullable)                            |
| `gluten_rating` | TEXT    | `gluten_free` \| `gluten_trace` \| `gluten_content`          |
| `created_at`    | TEXT    | Timestamp                                                    |
| `updated_at`    | TEXT    | Timestamp                                                    |

The database is created and seeded with a few example products the first time
the app launches (see `src/db/database.ts`).

### Data source: local SQLite or the .NET/MSSQL backend

All screens depend only on the `ProductRepository` interface
(`src/data/ProductRepository.ts`), never on a specific storage engine. Two
implementations exist:

- `SqliteProductRepository` - local on-device `.db` file (offline, no server).
- `MssqlApiProductRepository` - calls the
  [UtenGluten-Backend](https://github.com/benjamincode123/UtenGluten-Backend)
  `.NET` Web API, which stores data in **Azure SQL Server**.

Which one is used is decided in a single place, `src/data/repository.ts`, based
on `src/config.ts`:

```ts
const repository: ProductRepository = config.useBackend
  ? new MssqlApiProductRepository(config.apiBaseUrl)
  : new SqliteProductRepository();
```

By default `useBackend` is `true`, so the app talks to the backend. To run fully
offline on SQLite instead, start Expo with `EXPO_PUBLIC_USE_BACKEND=false`.

### Running with the backend (Azure SQL)

1. Configure and start the API from
   [UtenGluten-Backend](https://github.com/benjamincode123/UtenGluten-Backend)
   (sibling folder `../UtenGluten-Backend`, or the deployed App Service).
2. Point the app at it and start Expo (use your computer's LAN IP, not localhost,
   when testing on a physical phone):

```bash
# PowerShell, from the repo root
$env:EXPO_PUBLIC_API_URL = "http://<your-computer-ip>:5178"
# Or the Azure App Service:
# $env:EXPO_PUBLIC_API_URL = "https://utengluten-cvg7h6fqgxhxd9cw.swedencentral-01.azurewebsites.net"
npm run start
```

## Project structure

```
app/
  _layout.tsx     Root layout; initializes the database
  index.tsx       Scanner screen (camera + live barcode + manual entry)
  result.tsx      Lookup result (product info or "not found" -> add)
  add.tsx         Add/edit product form
  products.tsx    Dev list of all products
app/
  login.tsx         Login / register screen (shown when signed out)
src/
  config.ts         API base URL + backend on/off switch
  auth/
    AuthContext.tsx   Auth state, sign in/up/out, admin flag
    session.ts        Secure token storage (expo-secure-store)
  components/
    GlutenBadge.tsx      Reusable rating badge
  data/
    ProductRepository.ts       Storage interface
    SqliteProductRepository.ts Local SQLite implementation
    MssqlApiProductRepository.ts .NET/MSSQL backend implementation
    authApi.ts                 Auth API client (register/login/logout/me)
    repository.ts              Provider that selects the active repository
  db/
    database.ts     SQLite init, schema, dev seed data
    types.ts        Product type + GlutenRating enum and UI metadata
```

The .NET API, product import `data/`, and download/import scripts live in a
separate repo:
[UtenGluten-Backend](https://github.com/benjamincode123/UtenGluten-Backend).

## Notes

- No external food API is used; the database is populated by seed data and user
  submissions.
- The app is iOS-first but the same Expo codebase also runs on Android.
