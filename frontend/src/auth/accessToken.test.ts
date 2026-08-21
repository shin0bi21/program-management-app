import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '../http/errors';
import { reAuthCoordinator } from './reauth/reAuthCoordinator';
import { getValidAccessToken, SessionError } from './accessToken';
import { STORAGE_KEYS } from './storage';

function tokenWithExpiry(expiryMs: number, marker = 'token'): string {
  return `header.${btoa(JSON.stringify({ exp: Math.floor(expiryMs / 1000), marker }))}.signature`;
}

describe('access token lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('window', { location: { href: '' } });
  });

  afterEach(() => {
    if (reAuthCoordinator.getSnapshot().status === 'prompting') {
      reAuthCoordinator.rejectReAuth();
    }
    vi.unstubAllGlobals();
  });

  it('rejects requests when no authenticated session exists', async () => {
    await expect(getValidAccessToken()).rejects.toMatchObject({
      name: 'SessionError',
      message: 'Authentication required. Please log in.',
    });
    await expect(getValidAccessToken()).rejects.toBeInstanceOf(SessionError);
  });

  it('returns a token that is not near expiry without refreshing it', async () => {
    const token = tokenWithExpiry(Date.now() + 60 * 60_000);
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);

    await expect(getValidAccessToken()).resolves.toBe(token);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent refreshes for a token near expiry', async () => {
    const token = tokenWithExpiry(Date.now() + 5 * 60_000, 'expiring');
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    let finishRefresh!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => {
      finishRefresh = resolve;
    }));

    const first = getValidAccessToken();
    const second = getValidAccessToken();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/refresh$/), expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      signal: expect.any(AbortSignal),
    }));

    finishRefresh(new Response(JSON.stringify({ token: 'fresh-token' }), { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual(['fresh-token', 'fresh-token']);
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe('fresh-token');
  });

  it('preserves the stored user when refreshing an access token', async () => {
    const token = tokenWithExpiry(Date.now() + 5 * 60_000, 'with-user');
    const user = { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' };
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ token: 'fresh-user-token' }), { status: 200 }),
    );

    await expect(getValidAccessToken()).resolves.toBe('fresh-user-token');
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe('fresh-user-token');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) ?? 'null')).toEqual(user);
  });

  it('clears the session and redirects when refresh is rejected', async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, tokenWithExpiry(Date.now() + 5 * 60_000, 'rejected'));
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ id: 'user-1' }));
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    await expect(getValidAccessToken()).rejects.toThrow('Token refresh failed');
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.USER)).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('rejects and clears the session when refresh returns no access token', async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, tokenWithExpiry(Date.now() + 5 * 60_000, 'malformed'));
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ token: null }), { status: 200 }),
    );

    await expect(getValidAccessToken()).rejects.toThrow('Token refresh returned an invalid response');
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBeNull();
  });

  it('maps fetch failures to NetworkError and resets the pending refresh', async () => {
    const firstToken = tokenWithExpiry(Date.now() + 5 * 60_000, 'offline');
    localStorage.setItem(STORAGE_KEYS.TOKEN, firstToken);
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'));

    await expect(getValidAccessToken()).rejects.toBeInstanceOf(NetworkError);
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe(firstToken);
    expect(window.location.href).toBe('');

    const retryToken = tokenWithExpiry(Date.now() + 5 * 60_000, 'retry');
    localStorage.setItem(STORAGE_KEYS.TOKEN, retryToken);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 'recovered-token' }), { status: 200 }),
    );

    await expect(getValidAccessToken()).resolves.toBe('recovered-token');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('waits for re-authentication when the stored token is expired', async () => {
    const expiredToken = tokenWithExpiry(Date.now() - 60_000, 'expired');
    const freshToken = tokenWithExpiry(Date.now() + 60 * 60_000, 'fresh');
    localStorage.setItem(STORAGE_KEYS.TOKEN, expiredToken);

    const request = getValidAccessToken();
    expect(reAuthCoordinator.getSnapshot().status).toBe('prompting');

    localStorage.setItem(STORAGE_KEYS.TOKEN, freshToken);
    reAuthCoordinator.resolveReAuth();

    await expect(request).resolves.toBe(freshToken);
  });
});
