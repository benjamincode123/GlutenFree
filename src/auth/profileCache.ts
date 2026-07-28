import * as SecureStore from 'expo-secure-store';

import type { AuthUser, XpProfile } from '../data/authApi';

const USER_KEY = 'uten_gluten_auth_user';
const XP_KEY = 'uten_gluten_xp_profile';

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
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthUser;
    memoryUser = {
      ...parsed,
      profileImageUrl: parsed.profileImageUrl ?? null,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
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
    const raw = await SecureStore.getItemAsync(XP_KEY);
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

export async function clearProfileCache(): Promise<void> {
  memoryUser = null;
  memoryXp = null;
  try {
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(XP_KEY);
  } catch {
    // ignore
  }
}
