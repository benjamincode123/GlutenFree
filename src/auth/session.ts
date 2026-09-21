import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'altuten.session.token';
const LEGACY_TOKEN_KEY = 'gluten_session_token';

// In-memory cache so synchronous callers (like the API repository) can read the
// current token without awaiting SecureStore.
let currentToken: string | null = null;

/** Loads the persisted token into memory. Call once on app startup. */
export async function loadToken(): Promise<string | null> {
  try {
    currentToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!currentToken) {
      const legacy = await SecureStore.getItemAsync(LEGACY_TOKEN_KEY);
      if (legacy) {
        currentToken = legacy;
        await SecureStore.setItemAsync(TOKEN_KEY, legacy).catch(() => undefined);
        await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY).catch(() => undefined);
      }
    }
  } catch {
    currentToken = null;
  }
  return currentToken;
}

/** Updates the in-memory token immediately (no disk I/O). */
export function setAuthToken(token: string): void {
  currentToken = token;
}

/** Persists the token securely and updates the in-memory cache. */
export async function saveToken(token: string): Promise<void> {
  currentToken = token;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Best-effort disk persistence.
  }
}

/** Clears the token from storage and memory. */
export async function clearToken(): Promise<void> {
  currentToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** Returns the current session token (or null), synchronously. */
export function getAuthToken(): string | null {
  return currentToken;
}
