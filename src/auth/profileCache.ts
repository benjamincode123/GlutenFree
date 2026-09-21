import * as SecureStore from 'expo-secure-store';

import type { AuthUser, XpProfile } from '../data/authApi';

const USER_KEY = 'altuten.auth.user';
const XP_KEY = 'altuten.xp.profile';
const LEGACY_USER_KEY = 'uten_gluten_auth_user';
const LEGACY_XP_KEY = 'uten_gluten_xp_profile';

/** Keep history short so SecureStore stays under platform size limits. */
const MAX_CACHED_HISTORY = 40;

let memoryUser: AuthUser | null = null;
let memoryXp: XpProfile | null = null;

export function getCachedUserSync(): AuthUser | null {
  return memoryUser;
}

export function getCachedXpProfileSync(): XpProfile | null {
  return memoryXp;
}

export async function saveCachedUser(user: AuthUser): Promise<void> {
  // Never persist large profile photos in SecureStore (platform size limits).
  const forDisk: AuthUser = {
    ...user,
    profileImageUrl: null,
    favorites: Array.isArray(user.favorites) ? user.favorites : [],
    unreadMessages: Array.isArray(user.unreadMessages) ? user.unreadMessages : [],
  };
  memoryUser = user;
  try {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(forDisk));
  } catch {
    // Best-effort persistence.
  }
}

export async function loadCachedUser(): Promise<AuthUser | null> {
  if (memoryUser) {
    return memoryUser;
  }
  try {
    let raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) {
      raw = await SecureStore.getItemAsync(LEGACY_USER_KEY);
      if (raw) {
        await SecureStore.setItemAsync(USER_KEY, raw).catch(() => undefined);
        await SecureStore.deleteItemAsync(LEGACY_USER_KEY).catch(() => undefined);
      }
    }
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthUser;
    memoryUser = {
      ...parsed,
      profileImageUrl: parsed.profileImageUrl ?? null,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      unreadMessages: Array.isArray(parsed.unreadMessages)
        ? parsed.unreadMessages
        : [],
    };
    return memoryUser;
  } catch {
    memoryUser = null;
    return null;
  }
}

export async function loadCachedXpProfile(): Promise<XpProfile | null> {
  if (memoryXp) {
    return memoryXp;
  }
  try {
    let raw = await SecureStore.getItemAsync(XP_KEY);
    if (!raw) {
      raw = await SecureStore.getItemAsync(LEGACY_XP_KEY);
      if (raw) {
        await SecureStore.setItemAsync(XP_KEY, raw).catch(() => undefined);
        await SecureStore.deleteItemAsync(LEGACY_XP_KEY).catch(() => undefined);
      }
    }
    if (!raw) {
      return null;
    }
    memoryXp = JSON.parse(raw) as XpProfile;
    return memoryXp;
  } catch {
    memoryXp = null;
    return null;
  }
}

export async function saveCachedXpProfile(profile: XpProfile): Promise<void> {
  const trimmed: XpProfile = {
    ...profile,
    history: profile.history.slice(0, MAX_CACHED_HISTORY),
  };
  memoryXp = trimmed;
  try {
    await SecureStore.setItemAsync(XP_KEY, JSON.stringify(trimmed));
  } catch {
    // Best-effort persistence.
  }
}

/** Drop in-memory profile/XP immediately (no disk I/O). */
export function clearProfileCacheMemory(): void {
  memoryUser = null;
  memoryXp = null;
}

export async function clearProfileCache(): Promise<void> {
  clearProfileCacheMemory();
  try {
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(LEGACY_USER_KEY);
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(XP_KEY);
    await SecureStore.deleteItemAsync(LEGACY_XP_KEY);
  } catch {
    // ignore
  }
}
