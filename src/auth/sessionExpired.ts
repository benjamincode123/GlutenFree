/**
 * Bridge between HTTP 401 handling and AuthContext.
 * When an authenticated API call fails with an expired/invalid session, the
 * error layer notifies here so AuthProvider can sign out and the root layout
 * can redirect to the login screen (instead of showing an error prompt).
 */

type SessionExpiredHandler = () => void;

let handler: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(next: SessionExpiredHandler | null): void {
  handler = next;
}

/** Called when the API reports an unauthorized/expired session. */
export function notifySessionExpired(): void {
  handler?.();
}
