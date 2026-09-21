import * as SecureStore from 'expo-secure-store';

const KEY = 'altuten.product.search.history.v1';
const LEGACY_KEY = 'product_search_history_v1';
const MAX_ITEMS = 5;

export async function loadProductSearchHistory(): Promise<string[]> {
  try {
    let raw = await SecureStore.getItemAsync(KEY);
    if (!raw) {
      raw = await SecureStore.getItemAsync(LEGACY_KEY);
      if (raw) {
        await SecureStore.setItemAsync(KEY, raw).catch(() => undefined);
        await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => undefined);
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export async function pushProductSearchHistory(term: string): Promise<string[]> {
  const trimmed = term.trim();
  if (!trimmed) {
    return loadProductSearchHistory();
  }

  const existing = await loadProductSearchHistory();
  const next = [
    trimmed,
    ...existing.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_ITEMS);

  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }

  return next;
}
