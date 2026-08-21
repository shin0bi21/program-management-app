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

describe('apiClient re-authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
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
});
