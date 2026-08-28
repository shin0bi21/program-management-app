import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPassword } from '../../../../auth/auth.api';
import { useResetPassword } from './useResetPassword';

const navigate = vi.hoisted(() => vi.fn());

vi.mock('../../../../auth/auth.api', () => ({ resetPassword: vi.fn() }));
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual<typeof import('react-router-dom')>('react-router-dom'),
  useNavigate: () => navigate,
}));

function renderResetPassword(path = '/reset-password?token=reset-token') {
  function wrapper({ children }: PropsWithChildren) {
    return <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >{children}</MemoryRouter>;
  }

  return renderHook(() => useResetPassword(), { wrapper });
}

describe('useResetPassword', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it('rejects submission when the route has no reset token', async () => {
    const { result } = renderResetPassword('/reset-password');

    await act(() => result.current.onSubmit({
      password: 'new-password',
      confirmPassword: 'new-password',
    }));

    expect(result.current.error).toBe('Invalid or missing reset token');
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('resets the password and returns to login after the success delay', async () => {
    vi.mocked(resetPassword).mockResolvedValue({});
    const { result } = renderResetPassword();

    await act(() => result.current.onSubmit({
      password: 'new-password',
      confirmPassword: 'new-password',
    }));

    expect(resetPassword).toHaveBeenCalledWith('reset-token', 'new-password');
    expect(result.current.message).toBe('Password reset successful');
    expect(navigate).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('cancels the delayed redirect when the reset flow unmounts', async () => {
    vi.mocked(resetPassword).mockResolvedValue({});
    const { result, unmount } = renderResetPassword();

    await act(() => result.current.onSubmit({
      password: 'new-password',
      confirmPassword: 'new-password',
    }));
    unmount();
    act(() => vi.runAllTimers());

    expect(navigate).not.toHaveBeenCalled();
  });

  it('cancels an earlier success redirect when a resubmission fails', async () => {
    vi.mocked(resetPassword)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Reset link expired'));
    const { result } = renderResetPassword();

    await act(() => result.current.onSubmit({
      password: 'new-password',
      confirmPassword: 'new-password',
    }));
    await act(() => result.current.onSubmit({
      password: 'new-password',
      confirmPassword: 'new-password',
    }));
    act(() => vi.runAllTimers());

    expect(result.current.error).toBe('Reset link expired');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('exposes reset failures without scheduling navigation', async () => {
    vi.mocked(resetPassword).mockRejectedValue(new Error('Reset link expired'));
    const { result } = renderResetPassword();

    await act(() => result.current.onSubmit({
      password: 'new-password',
      confirmPassword: 'new-password',
    }));

    expect(result.current.error).toBe('Reset link expired');
    act(() => vi.runAllTimers());
    expect(navigate).not.toHaveBeenCalled();
  });
});
