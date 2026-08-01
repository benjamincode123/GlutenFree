import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'altuten.scanWithAi.tutorial.lastSeenAt';
const HIDE_FOR_MS = 72 * 60 * 60 * 1000;

export async function shouldShowScanWithAiTutorial(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return true;
    const lastSeen = Number.parseInt(raw, 10);
    if (!Number.isFinite(lastSeen) || lastSeen <= 0) return true;
    return Date.now() - lastSeen >= HIDE_FOR_MS;
  } catch {
    return true;
  }
}

export async function markScanWithAiTutorialSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures — tutorial may show again next time.
  }
}
