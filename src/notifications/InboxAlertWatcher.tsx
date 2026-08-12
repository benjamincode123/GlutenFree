import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { useNotificationPrefs } from './NotificationPrefsContext';
import { presentLocalAlert, hasRegisteredPushToken } from './push';

const POLL_MS = 45_000;

/**
 * When remote Expo push is missing/misconfigured, still alert the user for new
 * inbox messages discovered via /me refresh (foreground + background polling).
 */
export function InboxAlertWatcher() {
  const { user, refreshUser, authEnabled } = useAuth();
  const { prefs, permissionGranted } = useNotificationPrefs();
  const { t, tf } = useI18n();
  const router = useRouter();
  const knownUnreadRef = useRef<Set<number> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Seed known unread so we don't alert for messages already present at login.
  useEffect(() => {
    if (!user) {
      knownUnreadRef.current = null;
      return;
    }
    knownUnreadRef.current = new Set(user.unreadMessages ?? []);
  }, [user?.id]);

  // Detect newly arrived unread inbox IDs and show a local OS alert.
  useEffect(() => {
    if (!user || !prefs.notifyInbox || !permissionGranted) return;

    const known = knownUnreadRef.current;
    const current = user.unreadMessages ?? [];
    if (known == null) {
      knownUnreadRef.current = new Set(current);
      return;
    }

    const newcomers = current.filter((id) => !known.has(id));
    knownUnreadRef.current = new Set(current);
    if (newcomers.length === 0) return;

    // Prefer remote Expo push when registered; local alert is the fallback.
    if (hasRegisteredPushToken()) return;

    const count = newcomers.length;
    void presentLocalAlert({
      title: t('nav.notifications'),
      body:
        count === 1
          ? t('notifications.localAlertOne')
          : tf('notifications.localAlertMany', { count }),
      data: { type: 'inbox' },
    });
  }, [
    user?.unreadMessages,
    user,
    prefs.notifyInbox,
    permissionGranted,
    t,
    tf,
  ]);

  // Poll profile while logged in so backgrounded app can still discover inbox.
  useEffect(() => {
    if (!authEnabled || !user || !prefs.notifyInbox) return;

    const tick = () => {
      void refreshUser().catch(() => undefined);
    };

    const id = setInterval(() => {
      if (appStateRef.current === 'active' || appStateRef.current === 'background') {
        tick();
      }
    }, POLL_MS);

    const onAppState = (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        tick();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [authEnabled, user?.id, prefs.notifyInbox, refreshUser, user]);

  // Tap on a notification opens the inbox.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (type === 'inbox' || type === 'xp') {
        router.push('/notifications');
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}
