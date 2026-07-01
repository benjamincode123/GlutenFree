import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { config } from '../config';
import * as authApi from '../data/authApi';
import { AuthUser } from '../data/authApi';
import { clearToken, getAuthToken, loadToken, saveToken } from './session';

/**
 * When the backend is disabled (local SQLite mode) there is no auth server, so
 * we act as a local admin. This keeps offline/dev usage fully functional.
 */
const LOCAL_ADMIN: AuthUser = {
  id: 0,
  username: 'local',
  level: 100,
  isAdmin: true,
};

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  isAdmin: boolean;
  authEnabled: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(config.useBackend ? null : LOCAL_ADMIN);
  const [initializing, setInitializing] = useState(config.useBackend);

  useEffect(() => {
    if (!config.useBackend) {
      return;
    }
    let cancelled = false;

    (async () => {
      const token = await loadToken();
      if (token) {
        try {
          const me = await authApi.fetchMe(token);
          if (!cancelled) setUser(me);
        } catch {
          await clearToken();
          if (!cancelled) setUser(null);
        }
      }
      if (!cancelled) setInitializing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username.trim(), password);
    await saveToken(result.token);
    setUser(result.user);
  }, []);

  const signUp = useCallback(async (username: string, password: string) => {
    const result = await authApi.register(username.trim(), password);
    await saveToken(result.token);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    const token = getAuthToken();
    if (token) {
      await authApi.logout(token);
    }
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      isAdmin: user?.isAdmin ?? false,
      authEnabled: config.useBackend,
      signIn,
      signUp,
      signOut,
    }),
    [user, initializing, signIn, signUp, signOut]
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
