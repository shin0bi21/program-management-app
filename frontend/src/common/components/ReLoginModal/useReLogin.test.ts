// Scope: verifies the re-login hook's authentication and error lifecycle.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '../../../auth/auth.api';
import { getUser, setAuthData } from '../../../auth/storage';
import { useReLogin } from './useReLogin';

vi.mock('../../../auth/auth.api', () => ({
  login: vi.fn(),
  verify2FA: vi.fn(),
  resend2FA: vi.fn(),
}));

vi.mock('../../../auth/storage', () => ({
  getUser: vi.fn(),
  setAuthData: vi.fn(),
}));

vi.mock('../../../auth/deviceFingerprint', () => ({
  getDeviceFingerprint: () => 'device-fingerprint',
  getDeviceName: () => 'Test browser',
}));

const storedUser = {
  id: 'user-1',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
};

describe('useReLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUser).mockReturnValue(storedUser);
  });

  it('stores a successful login and completes re-authentication', async () => {
    vi.mocked(login).mockResolvedValue({
      token: 'fresh-token',
      user: storedUser,
      message: 'Login successful',
    });
    const onReAuthenticated = vi.fn();
    const { result } = renderHook(() => useReLogin({ onReAuthenticated }));

    act(() => result.current.setPassword('correct-password'));
    await act(async () => result.current.submitPassword());

    expect(login).toHaveBeenCalledWith('test@example.com', 'correct-password', 'device-fingerprint');
    expect(setAuthData).toHaveBeenCalledWith('fresh-token', storedUser);
    expect(onReAuthenticated).toHaveBeenCalledOnce();
    expect(result.current.password).toBe('');
  });
});
