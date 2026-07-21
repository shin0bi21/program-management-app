import { api } from './config';
import { getToken } from '../../utils/storage';
import { isTokenExpired, getTimeUntilExpiry } from '../../utils/jwt';
import { refreshToken } from './tokenRefresh';
import { awaitReLogin } from './sessionExpired';
import { NetworkError, RequestTimeoutError, ApiError, AuthError } from '../../utils/clientErrors';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RequestOptions {
  /** Whether to attach a Bearer token. Default: true */
  auth?: boolean;
  /** Abort after this many ms. Default: 15 000 */
  timeout?: number;
  /** Pass your own AbortSignal (e.g. from useEffect cleanup) */
  signal?: AbortSignal;
}

// ─── Token management ────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let lastRefreshAt = 0;

async function getValidToken(): Promise<string> {
  const token = getToken();

  if (!token) {
    throw new AuthError();
  }

  if (isTokenExpired(token)) {
    // Session expired — show re-login modal and wait for re-authentication.
    await awaitReLogin();
    return getToken()!;
  }

  const now = Date.now();
  const timeUntilExpiry = getTimeUntilExpiry(token);
  const nearExpiry = timeUntilExpiry !== null && timeUntilExpiry < 10 * 60 * 1000;
  const cooldownPassed = now - lastRefreshAt > REFRESH_INTERVAL_MS;

  if (nearExpiry && cooldownPassed) {
    lastRefreshAt = now;
    return refreshToken();
  }

  return token;
}

// ─── Core execute ─────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 15_000;

async function rawFetch(url: string, init: RequestInit, timeout: number, callerSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (timedOut) throw new RequestTimeoutError(timeout);
      throw err;
    }
    if (err instanceof TypeError) throw new NetworkError();
    throw err;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

async function execute<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const { auth = true, timeout = DEFAULT_TIMEOUT, signal } = opts;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = await getValidToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method,
    credentials: 'include',
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };

  let res = await rawFetch(api(path), init, timeout, signal);

  // 401 retry — token was rejected server-side (revoked, clock skew).
  // Show re-login modal and retry once with a fresh token.
  if (auth && res.status === 401) {
    await awaitReLogin();
    const freshToken = getToken()!;
    res = await rawFetch(
      api(path),
      { ...init, headers: { ...headers, Authorization: `Bearer ${freshToken}` } },
      timeout,
      signal,
    );
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(
      res.status,
      err.error || err.message || 'Request failed',
      err.details,
      err.requestId,
    );
  }

  return res.json() as Promise<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) =>
    execute<T>('GET', path, undefined, opts),

  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    execute<T>('POST', path, body, opts),

  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    execute<T>('PUT', path, body, opts),

  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    execute<T>('PATCH', path, body, opts),

  delete: <T>(path: string, opts?: RequestOptions) =>
    execute<T>('DELETE', path, undefined, opts),
};
