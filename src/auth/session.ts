import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'gluten_session_token';

// In-memory cache so synchronous callers (like the API repository) can read the
// current token without awaiting SecureStore.
let currentToken: string | null = null;

/** Loads the persisted token into memory. Call once on app startup. */
export async function loadToken(): Promise<string | null> {
  try {
    currentToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    currentToken = null;
  }
  return currentToken;
}

/** Persists the token securely and updates the in-memory cache. */
export async function saveToken(token: string): Promise<void> {
  currentToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

/** Clears the token from storage and memory. */
export async function clearToken(): Promise<void> {
  currentToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Returns the current session token (or null), synchronously. */
export function getAuthToken(): string | null {
  return currentToken;
}
