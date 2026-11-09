import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPassword } from '../../../../auth/auth.api';
import { useResetPassword } from './useResetPassword';

vi.mock('../../../../auth/auth.api', () => ({ resetPassword: vi.fn() }));

const passwords = { newPassword: 'new-password', confirmPassword: 'new-password' };

describe('useResetPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects submission when the route has no reset token', async () => {
    const { result } = renderHook(() => useResetPassword('', vi.fn()));
    await act(() => result.current.onSubmit(passwords));

    expect(result.current.error).toBe('Invalid or missing reset token');
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('completes an accepted reset once and leaves navigation to its route', async () => {
    vi.mocked(resetPassword).mockResolvedValue({});
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useResetPassword('reset-token', onSuccess));

    await act(() => result.current.onSubmit(passwords));
    await act(() => result.current.onSubmit(passwords));

    expect(resetPassword).toHaveBeenCalledOnce();
    expect(resetPassword).toHaveBeenCalledWith('reset-token', 'new-password');
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('exposes reset failures and permits retry with the retained password', async () => {
    vi.mocked(resetPassword).mockRejectedValueOnce(new Error('Reset link expired')).mockResolvedValueOnce({});
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useResetPassword('reset-token', onSuccess));
    act(() => result.current.form.setValue('newPassword', passwords.newPassword));

    await act(() => result.current.onSubmit(passwords));
    expect(result.current.error).toBe('Reset link expired');
    expect(result.current.form.getValues('newPassword')).toBe(passwords.newPassword);
    expect(onSuccess).not.toHaveBeenCalled();

    await act(() => result.current.onSubmit(passwords));
    expect(result.current.error).toBe('');
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
