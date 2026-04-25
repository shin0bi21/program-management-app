import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { login } from '../../common/api/auth.api';
import { useAuth } from '../../../../common/context/AuthContext';
import { getDeviceFingerprint } from '../../../../common/utils/deviceFingerprint';
import { getErrorMessage } from '../../../../common/utils/errors';
import { STORAGE_KEYS } from '../../../../common/utils/storage';
import { loginSchema, type LoginFormData } from '../../common/validation/authSchemas';

export const useLogin = () => {
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { completeLogin } = useAuth();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');

    try {
      const deviceFingerprint = getDeviceFingerprint();
      const response = await login(data.email, data.password, deviceFingerprint);

      if (response.token) {
        const lastPath = localStorage.getItem(STORAGE_KEYS.LAST_AUTH_PATH) || '/settings/account';
        completeLogin(response.token, response.user, lastPath);
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
