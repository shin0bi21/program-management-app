import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { login } from '../../../../auth/auth.api';
import { getLastAuthPath, setAuthData } from '../../../../auth/storage';
import { useLogin } from './useLogin';

const authLogin = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock('../../../../auth/auth.api', () => ({ login: vi.fn() }));
vi.mock('../../../../auth/authContext', () => ({
  useAuth: () => ({ login: authLogin }),
}));
vi.mock('../../../../auth/deviceFingerprint', () => ({
  getDeviceFingerprint: () => 'device-fingerprint',
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

function wrapper({ children }: PropsWithChildren) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLastAuthPath).mockReturnValue('/staff/tasks');
  });

  it('stores a direct-login session and returns the user to their saved page', async () => {
    vi.mocked(login).mockResolvedValue({ message: 'Signed in', token: 'token', user });
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(() => result.current.onSubmit({ email: user.email, password: 'password123' }));

    expect(login).toHaveBeenCalledWith(user.email, 'password123', 'device-fingerprint');
    expect(setAuthData).toHaveBeenCalledWith('token', user);
    expect(authLogin).toHaveBeenCalledOnce();
    expect(getLastAuthPath).toHaveBeenCalledWith('user-1');
    expect(navigate).toHaveBeenCalledWith('/staff/tasks');
  });

  it('routes an untrusted login to password verification', async () => {
    vi.mocked(login).mockResolvedValue({
      message: 'Verification required',
      requiresVerification: true,
      userId: 'user-1',
    });
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(() => result.current.onSubmit({ email: user.email, password: 'password123' }));

    expect(navigate).toHaveBeenCalledWith('/verify-password', { state: { userId: 'user-1' } });
    expect(setAuthData).not.toHaveBeenCalled();
    expect(authLogin).not.toHaveBeenCalled();
  });

  it('exposes login failures without changing authentication state', async () => {
    vi.mocked(login).mockRejectedValue(new Error('Incorrect email or password'));
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(() => result.current.onSubmit({ email: user.email, password: 'wrong-password' }));

    expect(result.current.error).toBe('Incorrect email or password');
    expect(setAuthData).not.toHaveBeenCalled();
    expect(authLogin).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
