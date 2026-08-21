import { apiUrl, request } from '../http/transport';
import { getTimeUntilExpiry, isTokenExpired } from './jwt';
import { reAuthCoordinator } from './reauth/reAuthCoordinator';
import { clearAuthData, getToken, getUser, setAuthData, STORAGE_KEYS } from './storage';

const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

let lastRefreshedToken: string | null = null;
let lastRefreshAt = 0;
let pendingRefresh: Promise<string> | null = null;

export class SessionError extends Error {
  constructor(message = 'Authentication required. Please log in.') {
    super(message);
    this.name = 'SessionError';
  }
}

function requireValidStoredAccessToken(message?: string): string {
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    throw new SessionError(message);
  }
  return token;
}

export async function getValidAccessToken(): Promise<string> {
  const token = getToken();

  if (!token) throw new SessionError();
  if (isTokenExpired(token)) return reauthenticateAccessToken();

  const timeUntilExpiry = getTimeUntilExpiry(token);
  const nearExpiry = timeUntilExpiry !== null && timeUntilExpiry < REFRESH_THRESHOLD_MS;
  const refreshedRecently = token === lastRefreshedToken
    && Date.now() - lastRefreshAt <= REFRESH_COOLDOWN_MS;

  return nearExpiry && !refreshedRecently ? refreshAccessToken() : token;
}

async function refreshAccessToken(): Promise<string> {
  if (pendingRefresh) return pendingRefresh;

  pendingRefresh = requestAccessTokenRefresh()
    .then((token) => {
      lastRefreshedToken = token;
      lastRefreshAt = Date.now();
      return token;
    })
    .finally(() => {
      pendingRefresh = null;
    });
  return pendingRefresh;
}

async function requestAccessTokenRefresh(): Promise<string> {
  const response = await request(apiUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
  });

  try {
    if (!response.ok) throw new Error('Token refresh failed');

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('token' in data) || typeof data.token !== 'string') {
      throw new Error('Token refresh returned an invalid response');
    }
    const existingUser = getUser();
    if (existingUser) {
      setAuthData(data.token, existingUser);
    } else {
      localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
    }
    return data.token;
  } catch (error) {
    clearAuthData();
    window.location.href = '/login';
    throw error;
  }
}

export async function reauthenticateAccessToken(): Promise<string> {
  await reAuthCoordinator.requestReAuth();
  return requireValidStoredAccessToken('Re-authentication did not produce a valid session.');
}
