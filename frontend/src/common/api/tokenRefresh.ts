import { clearAuthData, getUser, setAuthData, STORAGE_KEYS } from '../utils/storage';
import { api } from './config';
import { NetworkError } from '../utils/clientErrors';

let refreshPromise: Promise<string> | null = null;

export async function refreshToken(): Promise<string> {
  // Prevent multiple simultaneous refresh requests
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      let res: Response;
      try {
        res = await fetch(api('/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
        });
      } catch (err) {
        if (err instanceof TypeError) throw new NetworkError();
        throw err;
      }

      if (!res.ok) throw new Error('Token refresh failed');

      const data = await res.json();

      const existingUser = getUser();
      if (existingUser) {
        setAuthData(data.token, existingUser);
      } else {
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
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
