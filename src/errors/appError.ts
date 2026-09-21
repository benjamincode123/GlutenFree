/**
 * Stable error codes for user-visible failures.
 * Never put technical/backend details in the message shown to users.
 */
import { notifySessionExpired } from '../auth/sessionExpired';

export type AppErrorCode =
  | 'network'
  | 'unavailable'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_credentials'
  | 'username_taken'
  | 'barcode_taken'
  | 'product_has_barcode'
  | 'validation'
  | 'search_too_short'
  | 'image_invalid'
  | 'lookup_failed'
  | 'search_failed'
  | 'save_failed'
  | 'report_failed'
  | 'login_failed'
  | 'register_failed'
  | 'conflict'
  | 'rate_limited'
  | 'generic';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly retryAfterSeconds?: number;
  readonly status?: number;

  constructor(code: AppErrorCode, retryAfterSeconds?: number, status?: number) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = status;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/** Map HTTP status + optional API error text into a stable app error code. */
export function appErrorFromHttp(
  status: number,
  apiError: string | undefined,
  fallback: AppErrorCode,
  retryAfterSeconds?: number
): AppError {
  const detail = (apiError ?? '').toLowerCase();
  const withStatus = (code: AppErrorCode, retryAfter?: number) =>
    new AppError(code, retryAfter, status);

  if (status === 429) {
    return withStatus(
      'rate_limited',
      retryAfterSeconds != null && retryAfterSeconds > 0 ? retryAfterSeconds : 1
    );
  }
  if (status === 401) {
    if (detail.includes('invalid username') || detail.includes('invalid password')) {
      return withStatus('invalid_credentials');
    }
    // Defer so callers finish throwing before AuthContext clears the session
    // and the root layout redirects to login.
    queueMicrotask(() => notifySessionExpired());
    return withStatus('unauthorized');
  }
  if (status === 403) {
    return withStatus('forbidden');
  }
  if (status === 404) {
    return withStatus('not_found');
  }
  if (status === 409) {
    if (detail.includes('already linked')) {
      return withStatus('barcode_taken');
    }
    if (detail.includes('already has a barcode')) {
      return withStatus('product_has_barcode');
    }
    if (detail.includes('username') && detail.includes('taken')) {
      return withStatus('username_taken');
    }
    return withStatus('conflict');
  }
  if (status === 400) {
    if (detail.includes('at least 6')) {
      return withStatus('search_too_short');
    }
    if (detail.includes('barcode is required') || detail.includes('barcode must be')) {
      return withStatus('validation');
    }
    if (detail.includes('image')) {
      return withStatus('image_invalid');
    }
    return withStatus('validation');
  }
  if (status >= 500) {
    return withStatus('unavailable');
  }
  return withStatus(fallback);
}

function retryAfterSecondsFrom(
  response: Response,
  bodySeconds: number | undefined
): number | undefined {
  if (typeof bodySeconds === 'number' && bodySeconds > 0) {
    return Math.ceil(bodySeconds);
  }
  const header = response.headers.get('Retry-After')?.trim();
  if (!header) return undefined;
  const asNumber = Number(header);
  if (Number.isFinite(asNumber) && asNumber > 0) return Math.ceil(asNumber);
  const at = Date.parse(header);
  if (!Number.isFinite(at)) return undefined;
  const seconds = Math.ceil((at - Date.now()) / 1000);
  return seconds > 0 ? seconds : undefined;
}

export async function readApiErrorBody(
  response: Response
): Promise<{ error?: string; retryAfterSeconds?: number }> {
  try {
    const body = (await response.json()) as {
      error?: string;
      retryAfterSeconds?: number;
      retryAfter?: number;
    };
    const fromBody =
      typeof body?.retryAfterSeconds === 'number'
        ? body.retryAfterSeconds
        : body?.retryAfter;
    return {
      error: body?.error?.trim() || undefined,
      retryAfterSeconds: retryAfterSecondsFrom(response, fromBody),
    };
  } catch {
    return {};
  }
}

export async function readApiErrorMessage(response: Response): Promise<string | undefined> {
  const body = await readApiErrorBody(response);
  return body.error;
}
