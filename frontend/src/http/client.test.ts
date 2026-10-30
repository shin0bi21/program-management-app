import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { reAuthCoordinator } from '../auth/reauth/reAuthCoordinator';
import { STORAGE_KEYS } from '../auth/storage';

function tokenWithExpiry(expiryMs: number): string {
  return `header.${btoa(JSON.stringify({ exp: Math.floor(expiryMs / 1000) }))}.signature`;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let unsubscribePromptListener: (() => void) | undefined;

describe('apiClient re-authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    unsubscribePromptListener?.();
    unsubscribePromptListener = undefined;
    vi.unstubAllGlobals();
  });

  it('waits on an expired token and sends the latest token', async () => {
    const expiredToken = tokenWithExpiry(Date.now() - 60_000);
    const freshToken = tokenWithExpiry(Date.now() + 60 * 60_000);
    localStorage.setItem(STORAGE_KEYS.TOKEN, expiredToken);
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ok: true }));

    const request = apiClient.get<{ ok: boolean }>('/protected');
    expect(reAuthCoordinator.getSnapshot().status).toBe('prompting');
    expect(fetch).not.toHaveBeenCalled();

    localStorage.setItem(STORAGE_KEYS.TOKEN, freshToken);
    reAuthCoordinator.resolveReAuth();

    await expect(request).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/protected$/), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: `Bearer ${freshToken}` }),
    }));
  });

  it('waits after a 401 and retries only once with the latest token', async () => {
    const originalToken = tokenWithExpiry(Date.now() + 60 * 60_000);
    const freshToken = tokenWithExpiry(Date.now() + 2 * 60 * 60_000);
    localStorage.setItem(STORAGE_KEYS.TOKEN, originalToken);
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const request = apiClient.get<{ ok: boolean }>('/protected');
    await vi.waitFor(() => expect(reAuthCoordinator.getSnapshot().status).toBe('prompting'));

    localStorage.setItem(STORAGE_KEYS.TOKEN, freshToken);
    reAuthCoordinator.resolveReAuth();

    await expect(request).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[1][1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: `Bearer ${freshToken}` }),
    }));
  });

  it('rejects when the single retry also returns 401 without prompting again', async () => {
    const originalToken = tokenWithExpiry(Date.now() + 60 * 60_000);
    const freshToken = tokenWithExpiry(Date.now() + 2 * 60 * 60_000);
    localStorage.setItem(STORAGE_KEYS.TOKEN, originalToken);
    let promptCount = 0;
    unsubscribePromptListener = reAuthCoordinator.subscribe(() => {
      if (reAuthCoordinator.getSnapshot().status === 'prompting') promptCount += 1;
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }));

    const request = apiClient.get('/protected');
    await vi.waitFor(() => expect(reAuthCoordinator.getSnapshot().status).toBe('prompting'));
    localStorage.setItem(STORAGE_KEYS.TOKEN, freshToken);
    reAuthCoordinator.resolveReAuth();

    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reAuthCoordinator.getSnapshot().status).toBe('idle');
    expect(promptCount).toBe(1);
  });

  it('uses one re-authentication workflow for concurrent expired requests', async () => {
    const expiredToken = tokenWithExpiry(Date.now() - 60_000);
    const freshToken = tokenWithExpiry(Date.now() + 60 * 60_000);
    localStorage.setItem(STORAGE_KEYS.TOKEN, expiredToken);
    vi.mocked(fetch).mockImplementation(async () => jsonResponse(200, { ok: true }));

    const first = apiClient.get('/first');
    const promptingSnapshot = reAuthCoordinator.getSnapshot();
    const second = apiClient.get('/second');

    expect(reAuthCoordinator.getSnapshot()).toBe(promptingSnapshot);
    expect(promptingSnapshot.status).toBe('prompting');

    localStorage.setItem(STORAGE_KEYS.TOKEN, freshToken);
    reAuthCoordinator.resolveReAuth();

    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('accepts an empty successful delete response', async () => {
    const token = tokenWithExpiry(Date.now() + 60 * 60_000);
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiClient.delete<void>('/tasks/task-1')).resolves.toBeUndefined();
  });

  it('returns blob responses through the shared request pipeline', async () => {
    const token = tokenWithExpiry(Date.now() + 60 * 60_000);
    const blob = new Blob(['report'], { type: 'text/plain' });
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    vi.mocked(fetch).mockResolvedValue(new Response(blob, { status: 200 }));

    const result = await apiClient.download('/reports/example');

    expect(result.type).toContain('text/plain');
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/reports\/example$/), expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
    }));
  });
  it.each(['expired', '401'] as const)('cancels one %s waiter without cancelling shared re-login', async mode => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, tokenWithExpiry(
      Date.now() + (mode === 'expired' ? -60_000 : 60 * 60_000),
    ));
    vi.mocked(fetch).mockImplementation(async () => jsonResponse(401, { error: 'Unauthorized' }));
    const controller = new AbortController();
    const cancelled = apiClient.get('/cancelled', { signal: controller.signal });
    const rejection = cancelled.catch((error: unknown) => error);
    const remaining = apiClient.get('/remaining');
    await vi.waitFor(() => expect(reAuthCoordinator.getSnapshot().status).toBe('prompting'));
    if (mode === '401') await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    controller.abort();
    await expect(rejection).resolves.toMatchObject({ name: 'AbortError' });
    expect(reAuthCoordinator.getSnapshot().status).toBe('prompting');
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockImplementation(async () => jsonResponse(200, { ok: true }));
    localStorage.setItem(STORAGE_KEYS.TOKEN, tokenWithExpiry(Date.now() + 60 * 60_000));
    reAuthCoordinator.resolveReAuth();

    await expect(remaining).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/remaining$/), expect.anything());
  });

});
