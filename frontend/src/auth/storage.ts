export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
} as const;

export const DEFAULT_AUTH_PATH = '/settings/account';

const LAST_AUTH_PATH_PREFIX = 'lastAuthPath:';

const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/verify-password',
  '/forgot-password',
  '/reset-password',
]);

function lastAuthPathKey(userId: string): string {
  return `${LAST_AUTH_PATH_PREFIX}${userId}`;
}

function isSafeAuthPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;

  const pathname = path.split(/[?#]/, 1)[0];
  return !PUBLIC_AUTH_PATHS.has(pathname);
}

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

export function rememberAuthPath(userId: string, path: string): void {
  if (!userId || !isSafeAuthPath(path)) return;
  localStorage.setItem(lastAuthPathKey(userId), path);
}

export function getLastAuthPath(userId: string | undefined): string {
  if (!userId) return DEFAULT_AUTH_PATH;

  const path = localStorage.getItem(lastAuthPathKey(userId));
  return path && isSafeAuthPath(path) ? path : DEFAULT_AUTH_PATH;
}
