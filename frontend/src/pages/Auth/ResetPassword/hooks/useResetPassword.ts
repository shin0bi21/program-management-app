import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { resetPassword } from '../../../../auth/auth.api';
import { getErrorMessage } from '../../../../http/errors';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}) satisfies z.ZodType<ResetPasswordFormData, ResetPasswordFormData>;

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
      await resetPassword(token, data.password);
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
