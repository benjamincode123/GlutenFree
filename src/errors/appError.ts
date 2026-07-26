/**
 * Stable error codes for user-visible failures.
 * Never put technical/backend details in the message shown to users.
 */
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

  constructor(code: AppErrorCode, retryAfterSeconds?: number) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
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

  if (status === 429) {
    return new AppError(
      'rate_limited',
      retryAfterSeconds != null && retryAfterSeconds > 0 ? retryAfterSeconds : 1
    );
  }
  if (status === 401) {
    if (detail.includes('invalid username') || detail.includes('invalid password')) {
      return new AppError('invalid_credentials');
    }
    return new AppError('unauthorized');
  }
  if (status === 403) {
    return new AppError('forbidden');
  }
  if (status === 404) {
    return new AppError('not_found');
  }
  if (status === 409) {
    if (detail.includes('already linked')) {
      return new AppError('barcode_taken');
    }
    if (detail.includes('already has a barcode')) {
      return new AppError('product_has_barcode');
    }
    if (detail.includes('username') && detail.includes('taken')) {
      return new AppError('username_taken');
    }
    return new AppError('conflict');
  }
  if (status === 400) {
    if (detail.includes('at least 6')) {
      return new AppError('search_too_short');
    }
    if (detail.includes('image')) {
      return new AppError('image_invalid');
    }
    return new AppError('validation');
  }
  if (status >= 500) {
    return new AppError('unavailable');
  }
  return new AppError(fallback);
}

export async function readApiErrorBody(
  response: Response
): Promise<{ error?: string; retryAfterSeconds?: number }> {
  try {
    const body = (await response.json()) as {
      error?: string;
      retryAfterSeconds?: number;
    };
    return {
      error: body?.error?.trim() || undefined,
      retryAfterSeconds:
        typeof body?.retryAfterSeconds === 'number' && body.retryAfterSeconds > 0
          ? Math.ceil(body.retryAfterSeconds)
          : undefined,
    };
  } catch {
    return {};
  }
}

export async function readApiErrorMessage(response: Response): Promise<string | undefined> {
  const body = await readApiErrorBody(response);
  return body.error;
}
