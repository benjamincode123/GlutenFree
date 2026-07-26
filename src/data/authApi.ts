import { config } from '../config';
import {
  AppError,
  appErrorFromHttp,
  readApiErrorBody,
} from '../errors/appError';

export interface FavoriteProductRef {
  catalog: 'glutenfri' | 'gluten';
  id: number;
}

export interface AuthUser {
  id: number;
  username: string;
  level: number;
  xp: number;
  isAdmin: boolean;
  publicUser: boolean;
  profileImageBase64?: string | null;
  favorites: FavoriteProductRef[];
}

export interface AuthResult {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

function authUrl(path: string): string {
  return `${config.apiBaseUrl.replace(/\/+$/, '')}/api/auth${path}`;
}

async function throwForAuthResponse(
  response: Response,
  fallback: 'login_failed' | 'register_failed' | 'unauthorized'
): Promise<never> {
  const body = await readApiErrorBody(response);
  throw appErrorFromHttp(response.status, body.error, fallback, body.retryAfterSeconds);
}

export async function register(username: string, password: string): Promise<AuthResult> {
  let response: Response;
  try {
    response = await fetch(authUrl('/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAuthResponse(response, 'register_failed');
  }
  const result = (await response.json()) as AuthResult;
  return { ...result, user: normalizeAuthUser(result.user) };
}

export async function login(username: string, password: string): Promise<AuthResult> {
  let response: Response;
  try {
    response = await fetch(authUrl('/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAuthResponse(response, 'login_failed');
  }
  const result = (await response.json()) as AuthResult;
  return { ...result, user: normalizeAuthUser(result.user) };
}

export async function fetchMe(token: string): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch(authUrl('/me'), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAuthResponse(response, 'unauthorized');
  }
  return normalizeAuthUser(await response.json());
}

export async function setPublicUser(
  token: string,
  publicUser: boolean
): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch(authUrl('/public-user'), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ publicUser }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAuthResponse(response, 'unauthorized');
  }
  return normalizeAuthUser(await response.json());
}

export async function setProfileImage(
  token: string,
  imageBase64: string | null
): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch(authUrl('/profile-image'), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ imageBase64: imageBase64 ?? '' }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAuthResponse(response, 'unauthorized');
  }
  return normalizeAuthUser(await response.json());
}

export async function setFavorites(
  token: string,
  favorites: FavoriteProductRef[]
): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch(authUrl('/favorites'), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ favorites }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAuthResponse(response, 'unauthorized');
  }
  return normalizeAuthUser(await response.json());
}

export async function addFavorite(
  token: string,
  favorite: FavoriteProductRef
): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch(authUrl('/favorites'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(favorite),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAuthResponse(response, 'unauthorized');
  }
  return normalizeAuthUser(await response.json());
}

export async function removeFavorite(
  token: string,
  favorite: FavoriteProductRef
): Promise<AuthUser> {
  let response: Response;
  try {
    const qs = `?catalog=${encodeURIComponent(favorite.catalog)}&id=${favorite.id}`;
    response = await fetch(authUrl(`/favorites${qs}`), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAuthResponse(response, 'unauthorized');
  }
  return normalizeAuthUser(await response.json());
}

function normalizeAuthUser(raw: AuthUser): AuthUser {
  return {
    ...raw,
    profileImageBase64: raw.profileImageBase64 ?? null,
    favorites: Array.isArray(raw.favorites) ? raw.favorites : [],
  };
}

export type XpHistoryReason = 'barcode_report' | 'product_submission' | 'other';

export interface XpHistoryItem {
  id: number;
  xpAmount: number;
  createdAt: string;
  reason: XpHistoryReason | string;
  detail: string | null;
}

export interface XpProfile {
  xp: number;
  level: number;
  xpLevel: number;
  isAdmin: boolean;
  levelMinXp: number;
  levelMaxXp: number;
  xpIntoLevel: number;
  xpForLevel: number;
  xpToNextLevel: number;
  progress: number;
  history: XpHistoryItem[];
}

export async function fetchXpProfile(token: string): Promise<XpProfile> {
  let response: Response;
  try {
    response = await fetch(authUrl('/xp'), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAuthResponse(response, 'unauthorized');
  }
  return (await response.json()) as XpProfile;
}

export async function logout(token: string): Promise<void> {
  try {
    await fetch(authUrl('/logout'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Best-effort: even if the server call fails, the client clears its token.
  }
}
