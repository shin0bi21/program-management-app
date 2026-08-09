import { beforeEach, describe, expect, it } from 'vitest';
import { clearAuthData, getToken, getUser, setAuthData, STORAGE_KEYS } from './storage';

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
});
