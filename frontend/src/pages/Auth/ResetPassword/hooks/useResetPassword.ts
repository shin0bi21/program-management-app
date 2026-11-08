import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { resetPassword } from '../../../../auth/auth.api';
import { getErrorMessage } from '../../../../http/errors';

interface ResetPasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}) satisfies z.ZodType<ResetPasswordFormData, ResetPasswordFormData>;

/**
 * Validates a replacement password and resets it using the token in the current URL.
 * Returns form state and submission feedback, then redirects to login after success.
 * @example const { form, onSubmit } = useResetPassword(); // bind the recovery form
 */
export const useResetPassword = () => {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeRef = useRef(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') || '';

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // A pending reset may finish after cleanup, before any redirect timer exists.
  useEffect(() => {
    activeRef.current = true;

    return () => {
      activeRef.current = false;
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
    };
  }, []);

  /**
   * Saves the validated replacement password and schedules login after success.
   * @param data - Matching replacement and confirmation values from the form resolver.
   * @example await onSubmit({ newPassword: 'replacement', confirmPassword: 'replacement' })
   */
  const onSubmit = async (data: ResetPasswordFormData) => {
    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = undefined;
    }
    setError('');
    setMessage('');

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    try {
      await resetPassword(token, data.newPassword);
      if (!activeRef.current) return;

      setMessage('Password reset successful');
      navigationTimerRef.current = setTimeout(() => navigate('/login'), 1000);
    } catch (err: unknown) {
      if (!activeRef.current) return;

      setError(getErrorMessage(err, 'Failed to reset password'));
    }
  };

  return {
    form,
    error,
    message,
    onSubmit,
    token,
  };
};
