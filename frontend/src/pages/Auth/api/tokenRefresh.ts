import { getTimeUntilExpiry } from '../../../common/utils/jwt';
import { clearAuthData, getToken, getUser, setAuthData } from '../../../common/utils/storage';
import { api } from '../../../common/api/config';

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
      // Refresh failed - clear auth and redirect to login
      clearAuthData();
      window.location.href = '/login';
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Auto-refresh token before it expires (check every minute)
export function startTokenRefreshTimer() {
  setInterval(async () => {
    const token = getToken();
    if (!token) return;

    try {
      // Decode JWT to check expiry
      const timeUntilExpiry = getTimeUntilExpiry(token);
      if (timeUntilExpiry === null) return;

      // Refresh if token expires in less than 2 minutes
      if (timeUntilExpiry < 2 * 60 * 1000 && timeUntilExpiry > 0) {
        console.log('Auto-refreshing token...');
        await refreshToken();
      }
    } catch (error) {
      // Invalid token format, ignore
    }
  }, 60 * 1000); // Check every minute
}
