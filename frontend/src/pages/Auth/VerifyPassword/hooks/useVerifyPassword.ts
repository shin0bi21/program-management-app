import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { verify2FA, resend2FA } from '../../common/api/auth.api';
import { useAuth } from '../../../../common/context/AuthContext';
import { getDeviceFingerprint, getDeviceName } from '../../../../common/utils/deviceFingerprint';
import { getErrorMessage } from '../../../../common/utils/errors';
import { setAuthData } from '../../../../common/utils/storage';
import { formatTime } from '../../../../common/utils/time';
import { verifyPasswordSchema, type VerifyPasswordFormData } from '../../common/validation/authSchemas';

export const useVerifyPassword = () => {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds

  const navigate = useNavigate();
  const location = useLocation();
  const { login: updateAuthState } = useAuth();

  const userId = (location.state as { userId?: string } | undefined)?.userId;

  const form = useForm<VerifyPasswordFormData>({
    resolver: zodResolver(verifyPasswordSchema),
    defaultValues: {
      trustDevice: false,
    },
  });

  // Redirect if no userId
  useEffect(() => {
    if (!userId) {
      navigate('/login');
    }
  }, [userId, navigate]);

  // Countdown timer for code expiration
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const onSubmit = async (data: VerifyPasswordFormData) => {
    if (!userId) return;
    setError('');
    setMessage('');

    try {
      const deviceFingerprint = data.trustDevice ? getDeviceFingerprint() : undefined;
      const deviceName = data.trustDevice ? getDeviceName() : undefined;

      const response = await verify2FA(
        userId,
        data.code,
        data.trustDevice ?? false,
        deviceFingerprint,
        deviceName
      );

      // Store token and user data
      setAuthData(response.token, response.user);

      // Update auth context
      updateAuthState();

      // Navigate to last visited authenticated page, or settings as default
      // (matches the trusted-device branch in useLogin)
      const lastPath = localStorage.getItem('lastAuthPath') || '/settings/account';
      navigate(lastPath);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Verification failed'));
    }
  };

  const handleResendCode = async () => {
    if (isResending || resendCooldown > 0 || !userId) return;

    setIsResending(true);
    setError('');
    setMessage('');

    try {
      await resend2FA(userId);
      setMessage('New verification code sent to your email');
      setResendCooldown(60); // 60 second cooldown
      setTimeRemaining(300); // Reset to 5 minutes
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to resend code'));
    } finally {
      setIsResending(false);
    }
  };

  return {
    form,
    error,
    message,
    isResending,
    resendCooldown,
    timeRemaining,
    onSubmit,
    handleResendCode,
    formatTime,
  };
};
