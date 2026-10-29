// Scope: verifies the re-login hook's authentication and error lifecycle.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, resend2FA, verify2FA } from '../../../auth.api';
import { getUser, setAuthData } from '../../../storage';
import { useReLogin } from './useReLogin';

vi.mock('../../../auth.api', () => ({
  login: vi.fn(),
  verify2FA: vi.fn(),
  resend2FA: vi.fn(),
}));

vi.mock('../../../storage', () => ({
  getUser: vi.fn(),
  setAuthData: vi.fn(),
}));

vi.mock('../../../deviceFingerprint', () => ({
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

  it('resends and verifies a pending user before completing re-authentication', async () => {
    vi.mocked(login).mockResolvedValue({
      message: 'Verification required', requiresVerification: true, userId: 'verification-user-1',
    });
    vi.mocked(resend2FA).mockResolvedValue({});
    vi.mocked(verify2FA).mockResolvedValue({ token: 'verified-token', user: storedUser });
    const onReAuthenticated = vi.fn();
    const { result } = renderHook(() => useReLogin({ onReAuthenticated }));

    act(() => result.current.setPassword('correct-password'));
    await act(async () => result.current.submitPassword());
    await act(async () => result.current.resendVerification());
    act(() => result.current.setCode('123456'));
    await act(async () => result.current.submitVerification());

    expect(verify2FA).toHaveBeenCalledWith(
      'verification-user-1', '123456', true, 'device-fingerprint', 'Test browser',
    );
    expect(setAuthData).toHaveBeenCalledWith('verified-token', storedUser);
    expect(onReAuthenticated).toHaveBeenCalledOnce();
    expect(result.current.code).toBe('');
    expect(resend2FA).toHaveBeenCalledWith('verification-user-1');
    expect(result.current.error).toBe('');
    expect(result.current.resending).toBe(false);
  });

  it.each([
    ['password', 'Incorrect password. Please try again.', () => vi.mocked(login).mockRejectedValue(new Error('Incorrect password. Please try again.'))],
    ['verification', 'Invalid code. Please try again.', () => vi.mocked(verify2FA).mockRejectedValue(new Error('Invalid code. Please try again.'))],
    ['resend', 'Failed to resend code.', () => vi.mocked(resend2FA).mockRejectedValue(new Error('Failed to resend code.'))],
  ])('releases pending state and exposes the %s failure', async (step, expectedError, rejectRequest) => {
    const onReAuthenticated = vi.fn();
    const { result } = renderHook(() => useReLogin({ onReAuthenticated }));
    if (step !== 'password') {
      vi.mocked(login).mockResolvedValue({
        message: 'Verification required', requiresVerification: true, userId: 'verification-user-1',
      });
      act(() => result.current.setPassword('correct-password'));
      await act(async () => result.current.submitPassword());
    }
    if (step === 'password') act(() => result.current.setPassword('wrong-password'));
    if (step === 'verification') act(() => result.current.setCode('000000'));
    rejectRequest();

    await act(async () => {
      if (step === 'password') await result.current.submitPassword();
      if (step === 'verification') await result.current.submitVerification();
      if (step === 'resend') await result.current.resendVerification();
    });

    expect(result.current.error).toBe(expectedError);
    expect(result.current.submitting).toBe(false);
    expect(result.current.resending).toBe(false);
    expect(setAuthData).not.toHaveBeenCalled();
    expect(onReAuthenticated).not.toHaveBeenCalled();
  });
});
