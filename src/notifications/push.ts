import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { config } from '../config';
import * as authApi from '../data/authApi';

/** Android channel for heads-up alerts (importance is frozen after first create). */
export const ANDROID_ALERTS_CHANNEL_ID = 'alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function resolveProjectId(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;

  const easProjectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId;
  return typeof easProjectId === 'string' &&
    easProjectId.length > 0 &&
    !easProjectId.startsWith('REPLACE_')
    ? easProjectId
    : undefined;
}

export async function getNotificationPermissionStatus(): Promise<
  Notifications.PermissionStatus
> {
  const current = await Notifications.getPermissionsAsync();
  return current.status;
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_ALERTS_CHANNEL_ID, {
    name: 'Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

/** Requests OS permission when needed. Returns true when granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    return false;
  }

  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.status === 'granted') {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return requested.granted || requested.status === 'granted';
}

export async function getExpoPushTokenAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return null;
  }

  await ensureAndroidChannel();
  const projectId = resolveProjectId();
  if (!projectId) {
    if (__DEV__) {
      console.warn(
        '[push] Missing Expo projectId. Set EXPO_PUBLIC_EAS_PROJECT_ID or app.json extra.eas.projectId (eas init).'
      );
    }
    return null;
  }

  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = result.data?.trim() ?? '';
    return token.length > 0 ? token : null;
  } catch (err) {
    if (__DEV__) {
      console.warn('[push] getExpoPushTokenAsync failed', err);
    }
    return null;
  }
}

let lastRegisteredPushToken: string | null = null;

/** True after a successful Expo push token upload this session. */
export function hasRegisteredPushToken(): boolean {
  return !!lastRegisteredPushToken;
}

/**
 * Registers the Expo push token with the backend when logged in.
 * Never clears a stored token when fetch fails — only clear on logout.
 */
export async function syncPushTokenWithBackend(
  token: string | null | undefined,
  clear = false
): Promise<void> {
  if (!config.useBackend) return;
  const authToken = token?.trim();
  if (!authToken) return;

  try {
    if (clear) {
      lastRegisteredPushToken = null;
      await authApi.setPushToken(authToken, null);
      return;
    }

    const pushToken = await getExpoPushTokenAsync();
    if (!pushToken) {
      // Keep any existing server token; do not wipe on permission/projectId failure.
      return;
    }
    await authApi.setPushToken(authToken, pushToken);
    lastRegisteredPushToken = pushToken;
  } catch {
    // Best-effort; settings toggles still work locally / via prefs API.
  }
}

/** Immediate local OS alert (works even when Expo remote push token is missing). */
export async function presentLocalAlert(params: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      sound: 'default',
      data: params.data,
      ...(Platform.OS === 'android'
        ? { channelId: ANDROID_ALERTS_CHANNEL_ID }
        : null),
    },
    trigger: null,
  });
}
