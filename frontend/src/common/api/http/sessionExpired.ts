/**
 * Promise bridge between apiClient and ReLoginModal.
 *
 * When a request hits an expired or rejected token:
 *  1. apiClient calls awaitReLogin() — this fires 'auth:sessionExpired' and
 *     returns a promise that all concurrent callers share.
 *  2. ReLoginModal listens for the event, shows itself, and calls resolveReLogin()
 *     on successful re-authentication.
 *  3. All waiting apiClient calls unblock and retry their requests.
 */

let pendingPromise: Promise<void> | null = null;
let resolver: (() => void) | null = null;

export function awaitReLogin(): Promise<void> {
  if (!pendingPromise) {
    pendingPromise = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
  }
  return pendingPromise;
}

export function resolveReLogin(): void {
  resolver?.();
  pendingPromise = null;
  resolver = null;
}
