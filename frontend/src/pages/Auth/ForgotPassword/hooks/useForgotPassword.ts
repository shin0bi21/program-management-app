import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPassword } from '../../../../auth/auth.api';
import { getErrorMessage } from '../../../../http/clientErrors';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../../common/validation/authSchemas';

export const useForgotPassword = () => {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError('');
    setMessage('');

    try {
      await forgotPassword(data.email);
      setMessage('Password reset email sent');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send reset email'));
    }
  };

  return {
    form,
    error,
    message,
    onSubmit,
  };
};
