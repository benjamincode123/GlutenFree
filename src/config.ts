import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_API_PORT = 5178;

/**
 * Host running Metro (same machine as the local .NET API in typical setup).
 * Expo updates this when your network/IP changes, so you don't hardcode a LAN IP.
 */
function getExpoDevHost(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
    // Legacy Expo manifest (SDK < 49 / older Expo Go).
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost,
  ];

  for (const value of candidates) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const host = value.trim().split(':')[0]?.trim();
    if (host) return host;
  }
  return null;
}

function resolveDevApiBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (override) {
    return override.replace(/\/+$/, '');
  }

  const port = Number.parseInt(process.env.EXPO_PUBLIC_API_PORT ?? '', 10);
  const apiPort = Number.isFinite(port) && port > 0 ? port : DEFAULT_API_PORT;

  const expoHost = getExpoDevHost();
  if (expoHost) {
    // Physical device / Expo Go: use the packager machine's current IP.
    // iOS Simulator / web often report localhost — that is correct there.
    if (Platform.OS === 'android' && (expoHost === 'localhost' || expoHost === '127.0.0.1')) {
      // Android emulator loopback to the host machine.
      return `http://10.0.2.2:${apiPort}`;
    }
    return `http://${expoHost}:${apiPort}`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${apiPort}`;
  }

  return `http://localhost:${apiPort}`;
}

function resolveApiBaseUrl(): string {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return resolveDevApiBaseUrl();
  }

  const production = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (production) {
    return production.replace(/\/+$/, '');
  }

  return `http://localhost:${DEFAULT_API_PORT}`;
}

/**
 * App runtime configuration.
 *
 * In development the API host is taken from Expo's Metro host (or localhost /
 * Android emulator loopback). You only need EXPO_PUBLIC_API_URL to force a
 * specific URL; otherwise leave it unset so network changes don't break the app.
 */
export const config = {
  /**
   * Base URL of the .NET backend API.
   */
  apiBaseUrl: resolveApiBaseUrl(),

  /**
   * When true, the app talks to the backend API (MSSQL via .NET). When false,
   * it uses the on-device SQLite database instead. Defaults to true.
   */
  useBackend: (process.env.EXPO_PUBLIC_USE_BACKEND ?? 'true').toLowerCase() !== 'false',
};
