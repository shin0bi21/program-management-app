import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { login } from '../../../../auth/auth.api';
import { useAuth } from '../../../../auth/authContext';
import { getDeviceFingerprint } from '../../../../auth/deviceFingerprint';
import { getErrorMessage } from '../../../../http/clientErrors';
import { setAuthData, STORAGE_KEYS } from '../../../../auth/storage';
import { loginSchema, type LoginFormData } from '../../common/validation/authSchemas';

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

      // Check if login was successful without verification (trusted device)
      if (response.token) {
        // Store token and user data
        setAuthData(response.token, response.user);

        // Update auth context
        updateAuthState();

        // Navigate to last visited authenticated page, or settings as default
        const lastPath = localStorage.getItem(STORAGE_KEYS.LAST_AUTH_PATH) || '/settings/account';
        navigate(lastPath);
      } else if (response.requiresVerification) {
        // Redirect to verification page
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
