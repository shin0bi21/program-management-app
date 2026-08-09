export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  LAST_AUTH_PATH: 'lastAuthPath',
} as const;

export function setAuthData(token: string, user: AuthUser): void {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

export function clearAuthData(): void {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
}

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

export function getUser(): AuthUser | null {
  const user = localStorage.getItem(STORAGE_KEYS.USER);
  if (!user) return null;

  try {
    return JSON.parse(user) as AuthUser;
  } catch {
    return null;
  }
}
