import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'altuten.scanner.holdCoach.seen';

/** True until the first-open scan hint has been shown. */
export async function shouldShowHoldToScanCoach(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return raw !== '1';
  } catch {
    return false;
  }
}

export async function markHoldToScanCoachSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, '1');
  } catch {
    // Ignore storage failures — the hint may show again next launch.
  }
}
