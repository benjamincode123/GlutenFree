/**
 * App runtime configuration.
 *
 * Values come from Expo public environment variables (any variable prefixed with
 * EXPO_PUBLIC_ is inlined into the app at build time). Set them before starting
 * Expo, for example:
 *
 *   $env:EXPO_PUBLIC_API_URL = "http://192.168.1.183:5178"
 *   npm run start
 */
export const config = {
  /**
   * Base URL of the .NET backend API.
   *
   * On a physical device this must be your computer's LAN IP (not localhost),
   * because "localhost" on the phone refers to the phone itself.
   */
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5178',

  /**
   * When true, the app talks to the backend API (MSSQL via .NET). When false,
   * it uses the on-device SQLite database instead. Defaults to true.
   */
  useBackend: (process.env.EXPO_PUBLIC_USE_BACKEND ?? 'true').toLowerCase() !== 'false',
};
