import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { login } from '../../../../auth/auth.api';
import { useAuth } from '../../../../auth/authContext';
import { getDeviceFingerprint } from '../../../../auth/deviceFingerprint';
import { getErrorMessage } from '../../../../http/errors';
import { getLastAuthPath, setAuthData } from '../../../../auth/storage';

export interface LoginFormData {
  email: string;
  password: string;
}

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
}) satisfies z.ZodType<LoginFormData, LoginFormData>;

export const useLogin = () => {
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login: updateAuthState } = useAuth();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');

    try {
      const deviceFingerprint = getDeviceFingerprint();
      const response = await login(data.email, data.password, deviceFingerprint);

      if (response.token) {
        setAuthData(response.token, response.user);
        updateAuthState();
        navigate(getLastAuthPath(response.user.id));
      } else if (response.requiresVerification) {
        navigate('/verify-password', { state: { userId: response.userId } });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Login failed. Please try again.'));
    }
  };

  return {
    form,
    error,
    onSubmit,
  };
};
