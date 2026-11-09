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

/**
 * Sends an authenticated request and consumes its response with cancellation and one re-login retry.
 * @param method - HTTP method for this endpoint.
 * @param path - API-relative endpoint path.
 * @param consume - Reads the successful response body before cancellation/timeout cleanup.
 * @param body - JSON or FormData request payload, when required.
 * @param opts - Authentication, timeout in milliseconds and caller cancellation.
 * @example sendRequest("GET", "/youth", response => response.json())
 */
async function sendRequest<T>(
  method: string,
  path: string,
  consume: (response: Response) => Promise<T>,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const { auth = true, timeout = DEFAULT_TIMEOUT, signal } = opts;

  const headers: Record<string, string> = {};
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = await getValidAccessToken(signal);
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

  const execute = () => request(apiUrl(path), { ...init, headers }, async res => {
    if (!res.ok) {
      const err = await res.json().catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        return { error: 'Request failed' };
      });
      throw new ApiError(
        res.status,
        err.error || err.message || 'Request failed',
        err.details,
        err.requestId,
      );
    }
    return consume(res);
  }, timeout, signal);

  try {
    return await execute();
  } catch (error) {
    if (!auth || !(error instanceof ApiError) || error.status !== 401) throw error;

    // Each caller can leave the shared re-login workflow independently.
    const freshToken = await reauthenticateAccessToken(signal);
    headers.Authorization = `Bearer ${freshToken}`;
    return execute();
  }
}

/**
 * Sends a request and parses its JSON result, accepting successful empty responses.
 * @param body - Endpoint command payload; omitted for bodyless reads.
 * @param opts - Authentication, timeout and cancellation supplied by the caller.
 * @example jsonRequest("GET", "/youth")
 */
async function jsonRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: RequestOptions,
): Promise<T> {
  return sendRequest(method, path, async res => {
    if (res.status === 204 || res.status === 205) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }, body, opts);
}

/**
 * Downloads a binary response through the shared authenticated request pipeline.
 * @param path - API-relative download endpoint.
 * @param opts - Caller cancellation, timeout and authentication options.
 * @example blobRequest("/files/report", { signal })
 */
async function blobRequest(path: string, opts?: RequestOptions): Promise<Blob> {
  return sendRequest('GET', path, res => res.blob(), undefined, opts);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const apiClient = {
  /**
   * Reads endpoint JSON with the supplied request options.
   * @example apiClient.get("/youth", { signal })
   */
  get: <T>(path: string, opts?: RequestOptions) =>
    jsonRequest<T>('GET', path, undefined, opts),

  /**
   * Posts an endpoint command and returns its JSON result.
   * @example apiClient.post("/tasks", fields)
   */
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    jsonRequest<T>('POST', path, body, opts),

  /**
   * Replaces endpoint values and returns their JSON result.
   * @example apiClient.put("/tasks/task-1", fields)
   */
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    jsonRequest<T>('PUT', path, body, opts),

  /**
   * Applies a focused endpoint change and returns its JSON result.
   * @example apiClient.patch("/tasks/task-1", { state: "completed" })
   */
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    jsonRequest<T>('PATCH', path, body, opts),

  /**
   * Deletes an endpoint record and accepts JSON or an empty success response.
   * @example apiClient.delete("/tasks/task-1")
   */
  delete: <T>(path: string, opts?: RequestOptions) =>
    jsonRequest<T>('DELETE', path, undefined, opts),

  download: blobRequest,

  /**
   * Posts supplied data and consumes the binary response through the shared request pipeline.
   * @param body - Data used to render the download.
   * @example apiClient.postDownload("/reports/attendance.pdf", attendance, { signal })
   */
  postDownload: (path: string, body: unknown, opts?: RequestOptions): Promise<Blob> =>
    sendRequest('POST', path, res => res.blob(), body, opts),
};
