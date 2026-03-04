import { isTokenExpired, getTimeUntilExpiry } from '../utils/jwt';
import { getToken } from '../utils/storage';
import { refreshToken } from './tokenRefresh';
import { awaitReLogin } from './sessionExpired';

/**
 * Sliding session model:
 * - Proactively refresh the access token at most once every REFRESH_INTERVAL_MS.
 *   This extends the session on activity without adding latency to every request.
 * - If the token is already expired when a request fires, show the re-login modal
 *   (user was inactive for > 1h) rather than silently redirecting.
 */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let lastRefreshAt = 0;

async function getValidToken(): Promise<string> {
  const token = getToken();

  if (!token || isTokenExpired(token)) {
    // Session expired — show re-login modal and wait for the user to re-authenticate.
    await awaitReLogin();
    // After re-login, storage has a fresh token.
    return getToken()!;
  }

  const now = Date.now();
  const timeUntilExpiry = getTimeUntilExpiry(token);

  // Proactively refresh if: enough time has passed since last refresh AND token
  // is within 10 minutes of expiring (avoids refreshing a brand-new token).
  const nearExpiry = timeUntilExpiry !== null && timeUntilExpiry < 10 * 60 * 1000;
  const cooldownPassed = now - lastRefreshAt > REFRESH_INTERVAL_MS;

  if (nearExpiry && cooldownPassed) {
    lastRefreshAt = now;
    return refreshToken();
  }

  return token;
}

/**
 * fetch() wrapper for authenticated API requests.
 *
 * - Extends the session on every request (proactive refresh when near expiry).
 * - Expired token → re-login modal; user stays on current page.
 * - 401 from server → re-login modal (revoked / clock skew edge cases).
 * - Multiple concurrent failing requests all wait on the same modal promise.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidToken();

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    // Token was rejected server-side — show re-login modal and retry once.
    await awaitReLogin();
    const freshToken = getToken()!;
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        Authorization: `Bearer ${freshToken}`,
      },
    });
  }

  return res;
}

