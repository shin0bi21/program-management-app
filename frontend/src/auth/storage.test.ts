import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAuthData,
  DEFAULT_AUTH_PATH,
  getLastAuthPath,
  getToken,
  getUser,
  rememberAuthPath,
  setAuthData,
  STORAGE_KEYS,
} from './storage';

const user = {
  id: 'user-1',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
};

describe('auth storage', () => {
  beforeEach(() => localStorage.clear());

  it('stores and retrieves authentication data', () => {
    setAuthData('token-1', user);

    expect(getToken()).toBe('token-1');
    expect(getUser()).toEqual(user);
  });

  it('clears token and user data without removing unrelated values', () => {
    setAuthData('token-1', user);
    localStorage.setItem('unrelated', 'preserved');

    clearAuthData();

    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('preserved');
  });

  it('returns null for malformed stored user data', () => {
    localStorage.setItem(STORAGE_KEYS.USER, '{invalid');
    expect(getUser()).toBeNull();
  });

  it('stores the last authenticated path independently for each user', () => {
    rememberAuthPath('user-1', '/programming/sessions?session=session-1');
    rememberAuthPath('user-2', '/settings/account');

    expect(getLastAuthPath('user-1')).toBe('/programming/sessions?session=session-1');
    expect(getLastAuthPath('user-2')).toBe('/settings/account');
  });

  it('falls back when a saved destination is missing or unsafe', () => {
    expect(getLastAuthPath('user-1')).toBe(DEFAULT_AUTH_PATH);

    localStorage.setItem('lastAuthPath:user-1', 'https://example.com/steal');
    expect(getLastAuthPath('user-1')).toBe(DEFAULT_AUTH_PATH);

    localStorage.setItem('lastAuthPath:user-1', '/login');
    expect(getLastAuthPath('user-1')).toBe(DEFAULT_AUTH_PATH);
  });
});
