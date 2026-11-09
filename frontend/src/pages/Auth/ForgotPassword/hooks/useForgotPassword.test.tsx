import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { forgotPassword } from '../../../../auth/auth.api';
import { useForgotPassword } from './useForgotPassword';

vi.mock('../../../../auth/auth.api', () => ({ forgotPassword: vi.fn() }));

describe('useForgotPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits the email and completes its request form', async () => {
    vi.mocked(forgotPassword).mockResolvedValue({});
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useForgotPassword(onSuccess));

    await act(() => result.current.onSubmit({ email: 'test@example.com' }));

    expect(forgotPassword).toHaveBeenCalledWith('test@example.com');
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(result.current.error).toBe('');
  });

  it('preserves failure feedback until a retry succeeds', async () => {
    vi.mocked(forgotPassword)
      .mockRejectedValueOnce(new Error('Email service unavailable'))
      .mockResolvedValueOnce({});
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useForgotPassword(onSuccess));

    await act(() => result.current.onSubmit({ email: 'test@example.com' }));
    expect(result.current.error).toBe('Email service unavailable');
    expect(onSuccess).not.toHaveBeenCalled();

    await act(() => result.current.onSubmit({ email: 'test@example.com' }));
    expect(result.current.error).toBe('');
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
