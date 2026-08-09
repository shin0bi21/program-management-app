import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '../http/clientErrors';
import { clearAuthData, getUser, setAuthData, STORAGE_KEYS } from './storage';
import { refreshToken } from './tokenRefresh';

vi.mock('./storage', () => ({
  STORAGE_KEYS: { TOKEN: 'token', USER: 'user', LAST_AUTH_PATH: 'lastAuthPath' },
  clearAuthData: vi.fn(),
  getUser: vi.fn(),
  setAuthData: vi.fn(),
}));

const user = {
  id: 'user-1',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
};

describe('token refresh', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('window', { location: { href: '' } });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('deduplicates concurrent refreshes and stores the token with the existing user', async () => {
    let finishRefresh!: (response: Response) => void;
    vi.mocked(getUser).mockReturnValue(user);
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => {
      finishRefresh = resolve;
    }));

    const first = refreshToken();
    const second = refreshToken();

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/refresh$/), {
      method: 'POST',
      credentials: 'include',
    });

    finishRefresh(new Response(JSON.stringify({ token: 'fresh-token' }), { status: 200 }));

    await expect(Promise.all([first, second])).resolves.toEqual(['fresh-token', 'fresh-token']);
    expect(setAuthData).toHaveBeenCalledOnce();
    expect(setAuthData).toHaveBeenCalledWith('fresh-token', user);
  });

  it('stores only the token when no user record exists', async () => {
    vi.mocked(getUser).mockReturnValue(null);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ token: 'fresh-token' }), { status: 200 }),
    );

    await expect(refreshToken()).resolves.toBe('fresh-token');
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe('fresh-token');
    expect(setAuthData).not.toHaveBeenCalled();
  });

  it('clears authentication and redirects when refresh is rejected', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    await expect(refreshToken()).rejects.toThrow('Token refresh failed');
    expect(clearAuthData).toHaveBeenCalledOnce();
    expect(window.location.href).toBe('/login');
  });

  it('maps fetch failures to NetworkError and resets the pending gate', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'recovered-token' }), { status: 200 }));
    vi.mocked(getUser).mockReturnValue(user);

    await expect(refreshToken()).rejects.toBeInstanceOf(NetworkError);
    await expect(refreshToken()).resolves.toBe('recovered-token');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
