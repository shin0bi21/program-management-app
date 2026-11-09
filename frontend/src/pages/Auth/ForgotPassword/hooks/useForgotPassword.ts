import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { forgotPassword } from '../../../../auth/auth.api';
import useSubmitLock from '../../../../common/hooks/useSubmitLock';
import { getErrorMessage } from '../../../../http/errors';

interface ForgotPasswordFormData {
  email: string;
}

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
}) satisfies z.ZodType<ForgotPasswordFormData, ForgotPasswordFormData>;

/**
 * Submits one mounted reset-request form, preserving its email after a failed request.
 * @param onSuccess - Completes this editor and shows the route's confirmation.
 * @example useForgotPassword(showConfirmation) // starts with an empty email
 */
export const useForgotPassword = (onSuccess: () => void) => {
  const [error, setError] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  /**
   * Requests a reset link once and ends the form after the server accepts it.
   * @param data - Email address validated by this form's schema.
   * @example onSubmit({ email: 'youth@example.com' }) // requests a reset link
   */
  const onSubmit = async (data: ForgotPasswordFormData) => {
    if (!tryLock()) return;

    setError('');

    try {
      await forgotPassword(data.email);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send reset email'));
      unlock();
      return;
    }

    onSuccess();
  };

  return {
    form,
    error,
    onSubmit,
  };
};
