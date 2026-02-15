import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPassword } from '../../api/auth.api';
import { getErrorMessage } from '../../../../common/utils/errors';
import { resetPasswordSchema, type ResetPasswordFormData } from '../../validation/authSchemas';

export const useResetPassword = () => {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') || '';

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError('');
    setMessage('');

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    try {
      await resetPassword(token, data.password);
      setMessage('Password reset successful');
      setTimeout(() => navigate('/login'), 1000);
    } catch (err: unknown) {
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
