import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { config } from '../config';
import * as authApi from '../data/authApi';
import { AuthUser, FavoriteProductRef } from '../data/authApi';
import {
  clearProfileCache,
  loadCachedUser,
  loadCachedXpProfile,
  saveCachedUser,
  saveCachedXpProfile,
} from './profileCache';
import { clearToken, getAuthToken, loadToken, saveToken } from './session';
import { clearCachedLeaderboard } from '../data/leaderboardCache';
import { clearCachedLists } from '../data/listsCache';

/**
 * When the backend is disabled (local SQLite mode) there is no auth server, so
 * we act as a local admin. This keeps offline/dev usage fully functional.
 */
const LOCAL_ADMIN: AuthUser = {
  id: 0,
  username: 'local',
  level: 100,
  xp: 1,
  isAdmin: true,
  publicUser: false,
  profileImageBase64: null,
  favorites: [],
};

const FAVORITES_SYNC_DELAY_MS = 2000;

function cloneFavorites(list: FavoriteProductRef[]): FavoriteProductRef[] {
  return list.map((f) => ({ catalog: f.catalog, id: f.id }));
}

function favoriteKey(f: FavoriteProductRef): string {
  return `${f.catalog}:${f.id}`;
}

function favoritesEqual(a: FavoriteProductRef[], b: FavoriteProductRef[]): boolean {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map(favoriteKey));
  return b.every((f) => keys.has(favoriteKey(f)));
}

/** Fetch /me + XP and persist both for the profile screen. */
async function fetchAndCacheProfile(
  token: string,
  fallbackUser?: AuthUser
): Promise<AuthUser> {
  const [meResult, xpResult] = await Promise.allSettled([
    authApi.fetchMe(token),
    authApi.fetchXpProfile(token),
  ]);

  let user: AuthUser;
  if (meResult.status === 'fulfilled') {
    user = meResult.value;
  } else if (fallbackUser) {
    user = fallbackUser;
  } else {
    throw meResult.reason;
  }

  if (xpResult.status === 'fulfilled') {
    const xp = xpResult.value;
    await saveCachedXpProfile(xp);
    user = {
      ...user,
      xp: xp.xp,
      level: xp.level,
    };
  }

  await saveCachedUser(user);
  return user;
}

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  isAdmin: boolean;
  authEnabled: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setPublicUser: (publicUser: boolean) => Promise<void>;
  setProfileImage: (imageBase64: string | null) => Promise<void>;
  addFavorite: (favorite: authApi.FavoriteProductRef) => Promise<void>;
  removeFavorite: (favorite: authApi.FavoriteProductRef) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(config.useBackend ? null : LOCAL_ADMIN);
  const [initializing, setInitializing] = useState(config.useBackend);

  /** Last favorites confirmed with the server (or local baseline). */
  const syncedFavoritesRef = useRef<FavoriteProductRef[]>([]);
  /** Latest local favorites (may include pending optimistic edits). */
  const latestFavoritesRef = useRef<FavoriteProductRef[]>([]);
  const favoritesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const favoritesSyncGenerationRef = useRef(0);

  const rememberSyncedFavorites = useCallback((favorites: FavoriteProductRef[]) => {
    const cloned = cloneFavorites(favorites);
    syncedFavoritesRef.current = cloned;
    latestFavoritesRef.current = cloned;
  }, []);

  const clearFavoritesSyncTimer = useCallback(() => {
    if (favoritesTimerRef.current) {
      clearTimeout(favoritesTimerRef.current);
      favoritesTimerRef.current = null;
    }
  }, []);

  const flushFavoritesToServer = useCallback(async () => {
    if (!config.useBackend) return;

    const token = getAuthToken();
    if (!token) return;

    const pending = cloneFavorites(latestFavoritesRef.current);
    if (favoritesEqual(pending, syncedFavoritesRef.current)) {
      return;
    }

    const generation = ++favoritesSyncGenerationRef.current;
    try {
      const updated = await authApi.setFavorites(token, pending);
      // A newer local edit happened while this request was in flight.
      if (generation !== favoritesSyncGenerationRef.current) {
        return;
      }

      if (!favoritesEqual(latestFavoritesRef.current, pending)) {
        // User kept editing; keep local list and schedule another sync.
        syncedFavoritesRef.current = cloneFavorites(updated.favorites);
        setUser((prev) => {
          if (!prev) return updated;
          const next = {
            ...updated,
            favorites: cloneFavorites(latestFavoritesRef.current),
            profileImageBase64: prev.profileImageBase64 ?? updated.profileImageBase64,
          };
          void saveCachedUser(next);
          return next;
        });
        clearFavoritesSyncTimer();
        favoritesTimerRef.current = setTimeout(() => {
          favoritesTimerRef.current = null;
          void flushFavoritesToServer();
        }, FAVORITES_SYNC_DELAY_MS);
        return;
      }

      rememberSyncedFavorites(updated.favorites);
      setUser((prev) => {
        if (!prev) return updated;
        const next = {
          ...updated,
          profileImageBase64: prev.profileImageBase64 ?? updated.profileImageBase64,
        };
        void saveCachedUser(next);
        return next;
      });
    } catch {
      if (generation !== favoritesSyncGenerationRef.current) {
        return;
      }
      // If the user kept editing, keep local state and try again after the debounce.
      if (!favoritesEqual(latestFavoritesRef.current, pending)) {
        clearFavoritesSyncTimer();
        favoritesTimerRef.current = setTimeout(() => {
          favoritesTimerRef.current = null;
          void flushFavoritesToServer();
        }, FAVORITES_SYNC_DELAY_MS);
        return;
      }
      // Revert UI to last synced server state.
      const reverted = cloneFavorites(syncedFavoritesRef.current);
      latestFavoritesRef.current = reverted;
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, favorites: reverted };
        void saveCachedUser(next);
        return next;
      });
    }
  }, [clearFavoritesSyncTimer, rememberSyncedFavorites]);

  const scheduleFavoritesSync = useCallback(() => {
    if (!config.useBackend) return;
    clearFavoritesSyncTimer();
    favoritesTimerRef.current = setTimeout(() => {
      favoritesTimerRef.current = null;
      void flushFavoritesToServer();
    }, FAVORITES_SYNC_DELAY_MS);
  }, [clearFavoritesSyncTimer, flushFavoritesToServer]);

  useEffect(() => {
    if (!config.useBackend) {
      return;
    }
    let cancelled = false;

    (async () => {
      const [token, cached] = await Promise.all([loadToken(), loadCachedUser()]);
      if (token && cached && !cancelled) {
        rememberSyncedFavorites(cached.favorites ?? []);
        setUser(cached);
        // Warm XP cache from disk so the profile page can render immediately.
        void loadCachedXpProfile();
        setInitializing(false);
      }

      if (token) {
        try {
          const profile = await fetchAndCacheProfile(token, cached ?? undefined);
          if (!cancelled) {
            rememberSyncedFavorites(profile.favorites);
            setUser(profile);
          }
        } catch {
          await clearToken();
          await clearProfileCache();
          if (!cancelled) setUser(null);
        }
      }

      if (!cancelled) setInitializing(false);
    })();

    return () => {
      cancelled = true;
      clearFavoritesSyncTimer();
    };
  }, [clearFavoritesSyncTimer, rememberSyncedFavorites]);

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username.trim(), password);
    await clearProfileCache();
    clearCachedLeaderboard();
    clearCachedLists();
    await saveToken(result.token);
    const profile = await fetchAndCacheProfile(result.token, result.user);
    rememberSyncedFavorites(profile.favorites);
    setUser(profile);
  }, [rememberSyncedFavorites]);

  const signOut = useCallback(async () => {
    clearFavoritesSyncTimer();
    favoritesSyncGenerationRef.current += 1;
    const token = getAuthToken();
    if (token) {
      await authApi.logout(token);
    }
    await clearToken();
    await clearProfileCache();
    clearCachedLeaderboard();
    clearCachedLists();
    syncedFavoritesRef.current = [];
    latestFavoritesRef.current = [];
    setUser(null);
  }, [clearFavoritesSyncTimer]);

  const refreshUser = useCallback(async () => {
    if (!config.useBackend) {
      return;
    }
    clearFavoritesSyncTimer();
    favoritesSyncGenerationRef.current += 1;
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      await clearProfileCache();
      return;
    }
    const profile = await fetchAndCacheProfile(token);
    rememberSyncedFavorites(profile.favorites);
    setUser(profile);
  }, [clearFavoritesSyncTimer, rememberSyncedFavorites]);

  const setPublicUser = useCallback(async (publicUser: boolean) => {
    if (!config.useBackend) {
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, publicUser };
        void saveCachedUser(next);
        return next;
      });
      return;
    }
    const token = getAuthToken();
    if (!token) {
      throw new Error('unauthorized');
    }
    const updated = await authApi.setPublicUser(token, publicUser);
    setUser((prev) => {
      if (!prev) return updated;
      const next = {
        ...updated,
        favorites: prev.favorites,
        profileImageBase64: prev.profileImageBase64 ?? updated.profileImageBase64,
      };
      void saveCachedUser(next);
      return next;
    });
  }, []);

  const setProfileImage = useCallback(async (imageBase64: string | null) => {
    if (!config.useBackend) {
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, profileImageBase64: imageBase64 };
        void saveCachedUser(next);
        return next;
      });
      return;
    }
    const token = getAuthToken();
    if (!token) {
      throw new Error('unauthorized');
    }
    const updated = await authApi.setProfileImage(token, imageBase64);
    setUser((prev) => {
      if (!prev) return updated;
      const next = {
        ...updated,
        favorites: prev.favorites,
        profileImageBase64: updated.profileImageBase64,
      };
      void saveCachedUser(next);
      return next;
    });
  }, []);

  const addFavorite = useCallback(
    async (favorite: authApi.FavoriteProductRef) => {
      let changed = false;
      setUser((prev) => {
        if (!prev) return prev;
        const exists = prev.favorites.some(
          (f) => f.catalog === favorite.catalog && f.id === favorite.id
        );
        if (exists) return prev;
        changed = true;
        const next = { ...prev, favorites: [...prev.favorites, favorite] };
        latestFavoritesRef.current = cloneFavorites(next.favorites);
        void saveCachedUser(next);
        return next;
      });
      if (changed) {
        scheduleFavoritesSync();
      }
    },
    [scheduleFavoritesSync]
  );

  const removeFavorite = useCallback(
    async (favorite: authApi.FavoriteProductRef) => {
      let changed = false;
      setUser((prev) => {
        if (!prev) return prev;
        const exists = prev.favorites.some(
          (f) => f.catalog === favorite.catalog && f.id === favorite.id
        );
        if (!exists) return prev;
        changed = true;
        const next = {
          ...prev,
          favorites: prev.favorites.filter(
            (f) => !(f.catalog === favorite.catalog && f.id === favorite.id)
          ),
        };
        latestFavoritesRef.current = cloneFavorites(next.favorites);
        void saveCachedUser(next);
        return next;
      });
      if (changed) {
        scheduleFavoritesSync();
      }
    },
    [scheduleFavoritesSync]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      isAdmin: user?.isAdmin ?? false,
      authEnabled: config.useBackend,
      signIn,
      signOut,
      refreshUser,
      setPublicUser,
      setProfileImage,
      addFavorite,
      removeFavorite,
    }),
    [
      user,
      initializing,
      signIn,
      signOut,
      refreshUser,
      setPublicUser,
      setProfileImage,
      addFavorite,
      removeFavorite,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return ctx;
}
