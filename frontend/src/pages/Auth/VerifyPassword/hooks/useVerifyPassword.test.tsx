import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resend2FA, verify2FA } from '../../../../auth/auth.api';
import { getLastAuthPath, setAuthData } from '../../../../auth/storage';
import { useVerifyPassword } from './useVerifyPassword';

const authLogin = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock('../../../../auth/auth.api', () => ({ resend2FA: vi.fn(), verify2FA: vi.fn() }));
vi.mock('../../../../auth/authContext', () => ({
  useAuth: () => ({ login: authLogin }),
}));
vi.mock('../../../../auth/deviceFingerprint', () => ({
  getDeviceFingerprint: () => 'device-fingerprint',
  getDeviceName: () => 'Test Browser',
}));
vi.mock('../../../../auth/storage', () => ({
  getLastAuthPath: vi.fn(),
  setAuthData: vi.fn(),
}));
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual<typeof import('react-router-dom')>('react-router-dom'),
  useNavigate: () => navigate,
}));

const user = {
  id: 'user-1',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
};

function renderVerification(state: unknown = null) {
  function wrapper({ children }: PropsWithChildren) {
    return (
      <MemoryRouter initialEntries={[{
        pathname: '/verify-password',
        state,
      }]}
      >
        {children}
      </MemoryRouter>
    );
  }

  return renderHook(() => useVerifyPassword(), { wrapper });
}

describe('useVerifyPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLastAuthPath).mockReturnValue('/programming/sessions');
  });

  it('returns to login when verification has no user context', async () => {
    renderVerification();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'));
  });

  it.each([{ userId: 42 }, { userId: '   ' }, 'invalid context'])(
    'rejects malformed verification context %j before making auth requests',
    async state => {
      const { result } = renderVerification(state);

      await act(async () => {
        await result.current.onSubmit({ code: '123456' });
        await result.current.handleResendCode();
      });

      expect(navigate).toHaveBeenCalledWith('/login');
      expect(verify2FA).not.toHaveBeenCalled();
      expect(resend2FA).not.toHaveBeenCalled();
    },
  );

  it('verifies a trusted device, stores auth, and restores the saved route', async () => {
    vi.mocked(verify2FA).mockResolvedValue({ token: 'token', user });
    const { result } = renderVerification({ userId: 'user-1' });

    await act(() => result.current.onSubmit({ code: '123456', trustDevice: true }));

    expect(verify2FA).toHaveBeenCalledWith(
      'user-1',
      '123456',
      true,
      'device-fingerprint',
      'Test Browser',
    );
    expect(setAuthData).toHaveBeenCalledWith('token', user);
    expect(authLogin).toHaveBeenCalledOnce();
    expect(getLastAuthPath).toHaveBeenCalledWith('user-1');
    expect(navigate).toHaveBeenCalledWith('/programming/sessions');
  });

  it('resends the code and starts a new cooldown window', async () => {
    vi.mocked(resend2FA).mockResolvedValue({});
    const { result } = renderVerification({ userId: 'user-1' });

    await act(() => result.current.handleResendCode());

    expect(resend2FA).toHaveBeenCalledWith('user-1');
    expect(result.current.message).toBe('New verification code sent to your email');
    expect(result.current.resendCooldown).toBe(60);
    expect(result.current.timeRemaining).toBe(300);
    expect(result.current.isResending).toBe(false);
  });

  it('exposes verification failures without storing a session', async () => {
    vi.mocked(verify2FA).mockRejectedValue(new Error('Invalid verification code'));
    const { result } = renderVerification({ userId: 'user-1' });

    await act(() => result.current.onSubmit({ code: '000000', trustDevice: false }));

    expect(result.current.error).toBe('Invalid verification code');
    expect(setAuthData).not.toHaveBeenCalled();
    expect(authLogin).not.toHaveBeenCalled();
  });
});
