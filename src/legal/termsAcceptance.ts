import * as SecureStore from 'expo-secure-store';

/** Bump when terms text changes so users must re-accept. */
export const TERMS_VERSION = '1';

const STORAGE_KEY = 'altuten.terms.accepted.version';

export async function hasAcceptedCurrentTerms(): Promise<boolean> {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    return stored === TERMS_VERSION;
  } catch {
    return false;
  }
}

export async function acceptCurrentTerms(): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, TERMS_VERSION);
}
