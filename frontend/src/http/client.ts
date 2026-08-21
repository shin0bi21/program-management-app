import { getValidAccessToken, reauthenticateAccessToken } from '../auth/accessToken';
import { ApiError } from './errors';
import { apiUrl, DEFAULT_TIMEOUT, request } from './transport';

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

// ─── Core execute ─────────────────────────────────────────────────────────────

async function sendRequest(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<Response> {
  const { auth = true, timeout = DEFAULT_TIMEOUT, signal } = opts;

  const headers: Record<string, string> = {};
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = await getValidAccessToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method,
    credentials: 'include',
    headers,
    ...(body !== undefined && {
      body: isFormData ? body : JSON.stringify(body),
    }),
  };

  let res = await request(apiUrl(path), init, timeout, signal);

  // 401 retry — token was rejected server-side (revoked, clock skew).
  // Show re-login modal and retry once with a fresh token.
  if (auth && res.status === 401) {
    const freshToken = await reauthenticateAccessToken();
    res = await request(
      apiUrl(path),
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

  return res;
}

async function jsonRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: RequestOptions,
): Promise<T> {
  const res = await sendRequest(method, path, body, opts);
  if (res.status === 204 || res.status === 205) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function blobRequest(path: string, opts?: RequestOptions): Promise<Blob> {
  const res = await sendRequest('GET', path, undefined, opts);
  return res.blob();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) =>
    jsonRequest<T>('GET', path, undefined, opts),

  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    jsonRequest<T>('POST', path, body, opts),

  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    jsonRequest<T>('PUT', path, body, opts),

  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    jsonRequest<T>('PATCH', path, body, opts),

  delete: <T>(path: string, opts?: RequestOptions) =>
    jsonRequest<T>('DELETE', path, undefined, opts),

  download: blobRequest,
};
