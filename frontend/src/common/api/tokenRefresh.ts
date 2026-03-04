import { getTimeUntilExpiry } from '../utils/jwt';
import { clearAuthData, getToken, getUser, setAuthData } from '../utils/storage';
import { api } from './config';

let refreshPromise: Promise<string> | null = null;

export async function refreshToken(): Promise<string> {
  // Prevent multiple simultaneous refresh requests
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(api('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Token refresh failed');

      const data = await res.json();

      const existingUser = getUser();
      if (existingUser) {
        setAuthData(data.token, existingUser);
      } else {
        localStorage.setItem('token', data.token);
      }
      return data.token;
    } catch (error) {
      // Refresh failed — clear auth and redirect to login
      clearAuthData();
      window.location.href = '/login';
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Starts a background timer that proactively refreshes the access token
 * before it expires. Returns the interval ID so the caller can clean up.
 */
export function startTokenRefreshTimer(): ReturnType<typeof setInterval> {
  return setInterval(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const timeUntilExpiry = getTimeUntilExpiry(token);
      if (timeUntilExpiry === null) return;

      // Refresh if token expires in less than 2 minutes
      if (timeUntilExpiry < 2 * 60 * 1000 && timeUntilExpiry > 0) {
        await refreshToken();
      }
    } catch {
      // Invalid token format — ignore, fetchWithAuth will handle it on next request
    }
  }, 60 * 1000);
}
