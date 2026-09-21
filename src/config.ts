/** Production AltUten API (Azure App Service). */
const PRODUCTION_API_URL =
  'https://utengluten-cvg7h6fqgxhxd9cw.swedencentral-01.azurewebsites.net';

/**
 * App runtime configuration.
 * Always uses the live AltUten API — never localhost or a LAN test server.
 */
export const config = {
  /**
   * Base URL of the .NET backend API.
   */
  apiBaseUrl: PRODUCTION_API_URL,

  /**
   * Web registration page (opened in the system browser from the app).
   */
  get registerUrl() {
    return `${this.apiBaseUrl.replace(/\/+$/, '')}/register`;
  },

  /**
   * Always talk to the live backend (MSSQL via .NET).
   */
  useBackend: true as const,
};
