import * as SecureStore from 'expo-secure-store';
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

import { useAuth } from '../auth/AuthContext';
import { getAuthToken } from '../auth/session';
import { config } from '../config';
import * as authApi from '../data/authApi';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  syncPushTokenWithBackend,
} from './push';

const STORAGE_KEY = 'gluten_notification_prefs_v1';

export interface NotificationPrefs {
  /** OS push when an in-app inbox notification arrives. Default on. */
  notifyInbox: boolean;
  /** OS push when the user earns XP. Default on. */
  notifyXp: boolean;
}

interface NotificationPrefsContextValue {
  prefs: NotificationPrefs;
  ready: boolean;
  /** Current OS permission: granted | denied | undetermined (and similar). */
  permissionStatus: string;
  permissionGranted: boolean;
  setNotifyInbox: (value: boolean) => Promise<void>;
  setNotifyXp: (value: boolean) => Promise<void>;
  /** Ask for OS permission and register push token if granted. */
  enableSystemNotifications: () => Promise<boolean>;
  refreshPermission: () => Promise<void>;
}

const DEFAULT_PREFS: NotificationPrefs = {
  notifyInbox: true,
  notifyXp: true,
};

const NotificationPrefsContext = createContext<
  NotificationPrefsContextValue | undefined
>(undefined);

async function loadLocalPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      notifyInbox:
        typeof parsed.notifyInbox === 'boolean'
          ? parsed.notifyInbox
          : DEFAULT_PREFS.notifyInbox,
      notifyXp:
        typeof parsed.notifyXp === 'boolean'
          ? parsed.notifyXp
          : DEFAULT_PREFS.notifyXp,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

async function saveLocalPrefs(prefs: NotificationPrefs): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures.
  }
}

export function NotificationPrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('undetermined');
  const syncedUserIdRef = useRef<number | null>(null);

  const refreshPermission = useCallback(async () => {
    try {
      const status = await getNotificationPermissionStatus();
      setPermissionStatus(status);
    } catch {
      setPermissionStatus('undetermined');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadLocalPrefs();
      if (!cancelled) {
        setPrefs(local);
        await refreshPermission();
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshPermission]);

  // Sync from /me prefs + register push token when signed in.
  useEffect(() => {
    if (!ready || !config.useBackend || !user) {
      syncedUserIdRef.current = null;
      return;
    }

    if (syncedUserIdRef.current === user.id) {
      return;
    }
    syncedUserIdRef.current = user.id;

    let cancelled = false;
    (async () => {
      const token = getAuthToken();
      if (!token) return;

      let next = await loadLocalPrefs();
      try {
        const remote = await authApi.fetchNotificationPreferences(token);
        if (cancelled) return;
        next = {
          notifyInbox: remote.notifyInboxPush,
          notifyXp: remote.notifyXpPush,
        };
        setPrefs(next);
        await saveLocalPrefs(next);
      } catch {
        // Keep local defaults.
      }

      const permission = await getNotificationPermissionStatus();
      if ((next.notifyInbox || next.notifyXp) && permission === 'granted') {
        await syncPushTokenWithBackend(token);
      }
      if (!cancelled) {
        await refreshPermission();
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally only re-run when user id / ready changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id, refreshPermission]);

  const persistAndSync = useCallback(
    async (next: NotificationPrefs) => {
      setPrefs(next);
      await saveLocalPrefs(next);

      if (!config.useBackend) return;
      const token = getAuthToken();
      if (!token) return;

      try {
        await authApi.setNotificationPreferences(token, {
          notifyInboxPush: next.notifyInbox,
          notifyXpPush: next.notifyXp,
        });
      } catch {
        // Local prefs remain the source of truth for UI.
      }

      if (next.notifyInbox || next.notifyXp) {
        await syncPushTokenWithBackend(token);
      }
    },
    []
  );

  const enableSystemNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    await refreshPermission();
    if (!granted) {
      return false;
    }

    const token = getAuthToken();
    if (token && (prefs.notifyInbox || prefs.notifyXp)) {
      await syncPushTokenWithBackend(token);
    }
    return true;
  }, [prefs.notifyInbox, prefs.notifyXp, refreshPermission]);

  const setNotifyInbox = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await enableSystemNotifications();
        if (!granted) {
          return;
        }
      }
      await persistAndSync({ ...prefs, notifyInbox: value });
    },
    [enableSystemNotifications, persistAndSync, prefs]
  );

  const setNotifyXp = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await enableSystemNotifications();
        if (!granted) {
          return;
        }
      }
      await persistAndSync({ ...prefs, notifyXp: value });
    },
    [enableSystemNotifications, persistAndSync, prefs]
  );

  const value = useMemo<NotificationPrefsContextValue>(
    () => ({
      prefs,
      ready,
      permissionStatus,
      permissionGranted: permissionStatus === 'granted',
      setNotifyInbox,
      setNotifyXp,
      enableSystemNotifications,
      refreshPermission,
    }),
    [
      prefs,
      ready,
      permissionStatus,
      setNotifyInbox,
      setNotifyXp,
      enableSystemNotifications,
      refreshPermission,
    ]
  );

  if (!ready) {
    return null;
  }

  return (
    <NotificationPrefsContext.Provider value={value}>
      {children}
    </NotificationPrefsContext.Provider>
  );
}

export function useNotificationPrefs(): NotificationPrefsContextValue {
  const ctx = useContext(NotificationPrefsContext);
  if (!ctx) {
    throw new Error(
      'useNotificationPrefs must be used within NotificationPrefsProvider.'
    );
  }
  return ctx;
}
