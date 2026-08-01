import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { config } from '../config';
import * as authApi from '../data/authApi';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function resolveProjectId(): string | undefined {
  const easProjectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId;
  return typeof easProjectId === 'string' && easProjectId.length > 0
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
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
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

  const requested = await Notifications.requestPermissionsAsync();
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
  try {
    const result = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = result.data?.trim() ?? '';
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/** Registers (or clears) the Expo push token with the backend when logged in. */
export async function syncPushTokenWithBackend(
  token: string | null | undefined,
  clear = false
): Promise<void> {
  if (!config.useBackend) return;
  const authToken = token?.trim();
  if (!authToken) return;

  try {
    if (clear) {
      await authApi.setPushToken(authToken, null);
      return;
    }

    const pushToken = await getExpoPushTokenAsync();
    await authApi.setPushToken(authToken, pushToken);
  } catch {
    // Best-effort; settings toggles still work locally / via prefs API.
  }
}
