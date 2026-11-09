import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { resetPassword } from '../../../../auth/auth.api';
import useSubmitLock from '../../../../common/hooks/useSubmitLock';
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
 * Validates and saves one mounted password draft using the supplied recovery token.
 * @param token - Recovery token; an empty token cannot submit.
 * @param onSuccess - Ends the editor and starts the route's completion feedback.
 * @example useResetPassword(token, finishReset) // initializes empty password fields
 */
export function useResetPassword(token: string, onSuccess: () => void) {
  const [error, setError] = useState('');
  const { tryLock, unlock } = useSubmitLock();
  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  /**
   * Saves the validated replacement once, retaining failed values for correction.
   * @param data - Matching password values accepted by the form resolver.
   * @example onSubmit({ newPassword: 'replacement', confirmPassword: 'replacement' })
   */
  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }
    if (!tryLock()) return;

    setError('');
    try {
      await resetPassword(token, data.newPassword);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Failed to reset password'));
      unlock();
      return;
    }

    onSuccess();
  };

  return { form, error, onSubmit };
}
