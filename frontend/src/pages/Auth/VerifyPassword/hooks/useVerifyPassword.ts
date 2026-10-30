import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { verify2FA, resend2FA } from '../../../../auth/auth.api';
import { useAuth } from '../../../../auth/authContext';
import { getDeviceFingerprint, getDeviceName } from '../../../../auth/deviceFingerprint';
import { getErrorMessage } from '../../../../http/errors';
import { getLastAuthPath, setAuthData } from '../../../../auth/storage';
import { formatTime } from '../../../../common/utils/time';

interface VerifyPasswordFormData {
  code: string;
  trustDevice?: boolean;
}

const verifyPasswordSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be numeric'),
  trustDevice: z.boolean().optional(),
}) satisfies z.ZodType<VerifyPasswordFormData, VerifyPasswordFormData>;

const verificationContextSchema = z.object({
  userId: z.string().trim().min(1),
});

export const useVerifyPassword = () => {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds

  const navigate = useNavigate();
  const location = useLocation();
  const { login: updateAuthState } = useAuth();

  const context = verificationContextSchema.safeParse(location.state);
  const userId = context.success ? context.data.userId : undefined;

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
      navigate(getLastAuthPath(response.user.id));
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
