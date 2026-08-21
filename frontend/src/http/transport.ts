import { NetworkError, RequestTimeoutError } from './errors';

const DEVELOPMENT_API_BASE_URL = import.meta.env.VITE_API_URL;
const PRODUCTION_API_BASE_URL = '/api';

const API_BASE_URL = (DEVELOPMENT_API_BASE_URL || PRODUCTION_API_BASE_URL).replace(/\/+$/, '');

export const DEFAULT_TIMEOUT = 15_000;

export const apiUrl = (route: string) => `${API_BASE_URL}/${route.replace(/^\/+/, '')}`;

export async function request(
  url: string,
  init: RequestInit,
  timeout = DEFAULT_TIMEOUT,
  callerSignal?: AbortSignal,
): Promise<Response> {

  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (timedOut) throw new RequestTimeoutError(timeout);
      throw error;
    }
    if (error instanceof TypeError) throw new NetworkError();
    throw error;
    
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
