import { AppError, AppErrorCode, isAppError } from './appError';
import { TranslationKey } from '../i18n/translations';

const ERROR_KEYS: Record<AppErrorCode, TranslationKey> = {
  network: 'errors.network',
  unavailable: 'errors.unavailable',
  unauthorized: 'errors.unauthorized',
  forbidden: 'errors.forbidden',
  not_found: 'errors.notFound',
  invalid_credentials: 'errors.invalidCredentials',
  username_taken: 'errors.usernameTaken',
  barcode_taken: 'errors.barcodeTaken',
  product_has_barcode: 'errors.productHasBarcode',
  validation: 'errors.validation',
  search_too_short: 'errors.searchTooShort',
  image_invalid: 'errors.imageInvalid',
  lookup_failed: 'errors.lookupFailed',
  search_failed: 'errors.searchFailed',
  save_failed: 'errors.saveFailed',
  report_failed: 'errors.reportFailed',
  login_failed: 'errors.loginFailed',
  register_failed: 'errors.registerFailed',
  conflict: 'errors.conflict',
  rate_limited: 'errors.rateLimited',
  generic: 'errors.generic',
};

/** Resolve a thrown value to a safe, translated user message. Never returns backend text. */
export function userFacingError(
  err: unknown,
  t: (key: TranslationKey) => string,
  fallback: AppErrorCode = 'generic',
  tf?: (key: TranslationKey, vars: Record<string, string | number>) => string
): string {
  if (isAppError(err) && err.code === 'rate_limited') {
    const seconds = err.retryAfterSeconds ?? 1;
    if (tf) {
      return tf('errors.rateLimited', { seconds });
    }
    return t('errors.rateLimited').replace('{seconds}', String(seconds));
  }
  if (isAppError(err)) {
    return t(ERROR_KEYS[err.code] ?? ERROR_KEYS.generic);
  }
  // Legacy string errors from older paths — map known safe cases, otherwise hide details.
  const message = err instanceof Error ? err.message : '';
  if (/already linked/i.test(message)) {
    return t(ERROR_KEYS.barcode_taken);
  }
  if (/already has a barcode/i.test(message)) {
    return t(ERROR_KEYS.product_has_barcode);
  }
  if (/invalid username or password/i.test(message)) {
    return t(ERROR_KEYS.invalid_credentials);
  }
  if (/username.*taken|already taken/i.test(message)) {
    return t(ERROR_KEYS.username_taken);
  }
  if (/network|failed to fetch|timeout/i.test(message)) {
    return t(ERROR_KEYS.network);
  }
  return t(ERROR_KEYS[fallback] ?? ERROR_KEYS.generic);
}

export function toAppError(err: unknown, fallback: AppErrorCode = 'generic'): AppError {
  if (isAppError(err)) return err;
  return new AppError(fallback);
}
