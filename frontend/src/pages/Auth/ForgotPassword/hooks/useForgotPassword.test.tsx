// Owns the Forgot Password request lifecycle and user-facing request state.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { forgotPassword } from '../../../../auth/auth.api';
import { useForgotPassword } from './useForgotPassword';

vi.mock('../../../../auth/auth.api', () => ({ forgotPassword: vi.fn() }));

describe('useForgotPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits the email and exposes the neutral success response', async () => {
    vi.mocked(forgotPassword).mockResolvedValue({});
    const { result } = renderHook(() => useForgotPassword());

    await act(() => result.current.onSubmit({ email: 'test@example.com' }));

    expect(forgotPassword).toHaveBeenCalledWith('test@example.com');
    expect(result.current.message).toBe('Password reset email sent');
    expect(result.current.error).toBe('');
  });

  it('exposes request failures and clears an earlier success', async () => {
    vi.mocked(forgotPassword)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Email service unavailable'));
    const { result } = renderHook(() => useForgotPassword());

    await act(() => result.current.onSubmit({ email: 'test@example.com' }));
    await act(() => result.current.onSubmit({ email: 'test@example.com' }));

    expect(result.current.message).toBe('');
    expect(result.current.error).toBe('Email service unavailable');
  });
});
