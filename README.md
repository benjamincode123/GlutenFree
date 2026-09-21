# AltUten

An iOS-first React Native (Expo) app for people with celiac disease and other
food allergies. Scan a grocery barcode to look up ingredients, allergens, and
gluten status from the live AltUten catalog.

## Features

- Barcode scanner (EAN-13/8, UPC-A/E, Code 128, QR) using the device camera.
- Product lookup against the production AltUten API (Azure App Service + Azure SQL).
- Three-level gluten rating with clear color coding:
  - **Gluten Free** (green) - confirmed gluten free.
  - **May Contain Traces** (amber) - made with or near gluten-containing foods.
  - **Contains Gluten** (red) - contains gluten.
- Add or edit products: when a scanned barcode is unknown, submit its barcode,
  name, ingredients/contents, and allergen info so it is recognized next time.
- Manual barcode entry fallback (useful in the iOS Simulator, which has no camera).
- User accounts: register/login, persistent sessions, favorites, lists, and XP.
- Roles: standard users can scan and look up products; admins can moderate the
  catalog. See the
  [UtenGluten-Backend](https://github.com/benjamincode123/UtenGluten-Backend)
  repo for how to promote an admin.

## Tech stack

- [Expo](https://expo.dev/) SDK 57 + React Native + TypeScript
- [expo-router](https://docs.expo.dev/router/introduction/) for navigation
- [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera/) for barcode scanning
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for local cache (`altuten.db`)

## Getting started

### Prerequisites

- Node.js 18+
- A development build or TestFlight/App Store build (barcode scanning needs a
  real device; Expo Go is not required for release builds)

### Install

```bash
npm install
```

### Run

```bash
npm run start
```

The app always talks to the production API:

`https://utengluten-cvg7h6fqgxhxd9cw.swedencentral-01.azurewebsites.net`

There is no localhost / LAN test-server override.

## How it works

### Data model

Local offline seed/cache uses SQLite (`altuten.db`). Catalog product ratings use:

| Column          | Type | Notes                                               |
| --------------- | ---- | --------------------------------------------------- |
| `gluten_rating` | TEXT | `gluten_free` \| `gluten_trace` \| `gluten_content` |

(Product gluten rating field names are API/domain values, not the app brand.)

### Backend

`src/config.ts` always sets `useBackend: true` and the production `apiBaseUrl`.
`src/data/repository.ts` uses `MssqlApiProductRepository` against that URL.

The .NET API, product import `data/`, and download/import scripts live in:

[UtenGluten-Backend](https://github.com/benjamincode123/UtenGluten-Backend)

## Project structure

```
app/                  Screens (scanner, result, add, login, admin, …)
src/
  config.ts           Production API URL (always on)
  auth/               Session + profile cache (altuten.* SecureStore keys)
  data/               API clients + product repository
  db/                 SQLite helpers + GlutenRating domain types
  i18n/               EN / NB strings
```

## Notes

- Bundle ID / package: `com.altuten.app`
- URL scheme: `altuten`
- The app is iOS-first but the same Expo codebase also runs on Android.
