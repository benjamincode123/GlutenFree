import { config } from '../config';
import {
  AppError,
  appErrorFromHttp,
  readApiErrorBody,
} from '../errors/appError';

export interface FavoriteProductRef {
  catalog: 'products' | 'products_se' | 'products_dk' | 'products_de';
  id: number;
}

export interface AuthUser {
  id: number;
  username: string;
  level: number;
  xp: number;
  isAdmin: boolean;
  publicUser: boolean;
  profileImageUrl?: string | null;
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

export type MembershipPlan = 'monthly' | 'yearly';
export type PaymentLinkChannel = 'email';

export interface RegisterStartResult {
  userId: number;
  plan: string;
  paymentLinkChannel: string;
  message: string;
}

/** Creates pending user, Stripe Checkout link, and sends it via SMS and/or email. */
export async function registerStart(
  username: string,
  password: string,
  email: string,
  phone: string,
  plan: MembershipPlan,
  smsVerificationId: string,
  smsCode: string,
  paymentLinkChannel: PaymentLinkChannel
): Promise<RegisterStartResult> {
  let response: Response;
  try {
    response = await fetch(authUrl('/register/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        username,
        password,
        email,
        phone,
        plan,
        smsVerificationId,
        smsCode,
        paymentLinkChannel,
      }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAuthResponse(response, 'register_failed');
  }
  return (await response.json()) as RegisterStartResult;
}

export interface RegisterSmsCodeResult {
  verificationId: string;
  expiresInSeconds: number;
}

/** Sends a TeleSign SMS OTP for registration phone verification. */
export async function registerSendSmsCode(phone: string): Promise<RegisterSmsCodeResult> {
  let response: Response;
  try {
    response = await fetch(authUrl('/register/sms-code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ phone }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAuthResponse(response, 'register_failed');
  }
  return (await response.json()) as RegisterSmsCodeResult;
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
    profileImageUrl: raw.profileImageUrl ?? null,
    favorites: Array.isArray(raw.favorites) ? raw.favorites : [],
  };
}

export type XpHistoryReason =
  | 'barcode_report'
  | 'product_submission'
  | 'wrong_info_report'
  | 'other';

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
