// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('HTTP transport', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('joins a configured API base URL and route with one slash', async () => {
    vi.stubEnv('VITE_API_URL', 'https://example.test/api/');
    const { apiUrl } = await import('./transport');

    expect(apiUrl('/accounts')).toBe('https://example.test/api/accounts');
    expect(apiUrl('accounts')).toBe('https://example.test/api/accounts');
  });

  it('uses the /api fallback when no URL is configured', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const { apiUrl } = await import('./transport');

    expect(apiUrl('/health')).toBe('/api/health');
  });

  it('aborts a stalled request at its timeout boundary', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const { request } = await import('./transport');

    const pendingRequest = request('/api/stalled', {}, res => res.text(), 25);
    const rejection = pendingRequest.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(25);

    await expect(rejection).resolves.toMatchObject({ name: 'RequestTimeoutError' });
  });

  it('does not send a request when the caller signal is already aborted', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
      expect(init.signal?.aborted).toBe(true);
      return Promise.reject(init.signal?.reason);
    }));
    const controller = new AbortController();
    controller.abort(new DOMException('Cancelled', 'AbortError'));
    const { request } = await import('./transport');

    await expect(request('/api/cancelled', {}, res => res.text(), 1000, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
  it.each(['cancel', 'timeout'] as const)('keeps %s active while reading the response body', async mode => {
    vi.useFakeTimers();
    let bodyStarted!: () => void;
    const reading = new Promise<void>(resolve => { bodyStarted = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => (
      new Response(new ReadableStream({
        start(controller) {
          init.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true });
        },
      }))
    )));
    const { request } = await import('./transport');
    const controller = new AbortController();
    const pending = request('/api/download', {}, res => {
      bodyStarted();
      return res.text();
    }, 25, controller.signal);
    const rejection = pending.catch((error: unknown) => error);
    await reading;

    if (mode === 'cancel') controller.abort();
    else await vi.advanceTimersByTimeAsync(25);

    await expect(rejection).resolves.toMatchObject({
      name: mode === 'cancel' ? 'AbortError' : 'RequestTimeoutError',
    });
    expect(vi.getTimerCount()).toBe(0);
  });

});
