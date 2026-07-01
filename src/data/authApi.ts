import { config } from '../config';

export interface AuthUser {
  id: number;
  username: string;
  level: number;
  isAdmin: boolean;
}

export interface AuthResult {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

function authUrl(path: string): string {
  return `${config.apiBaseUrl.replace(/\/+$/, '')}/api/auth${path}`;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    // Ignore non-JSON bodies.
  }
  return fallback;
}

export async function register(username: string, password: string): Promise<AuthResult> {
  const response = await fetch(authUrl('/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, 'Registration failed.'));
  }
  return (await response.json()) as AuthResult;
}

export async function login(username: string, password: string): Promise<AuthResult> {
  const response = await fetch(authUrl('/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, 'Login failed.'));
  }
  return (await response.json()) as AuthResult;
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const response = await fetch(authUrl('/me'), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(await readError(response, 'Session is no longer valid.'));
  }
  return (await response.json()) as AuthUser;
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
