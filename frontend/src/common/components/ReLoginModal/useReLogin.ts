import { useState } from 'react';
import { login, resend2FA, verify2FA } from '../../../auth/auth.api';
import { getDeviceFingerprint, getDeviceName } from '../../../auth/deviceFingerprint';
import { getErrorMessage } from '../../../http/clientErrors';
import { getUser, setAuthData } from '../../../auth/storage';

export type ReLoginStep = 'password' | 'verify';

interface UseReLoginOptions {
  onReAuthenticated: () => void;
}

export function useReLogin({ onReAuthenticated }: UseReLoginOptions) {
  const [step, setStep] = useState<ReLoginStep>('password');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const storedUser = getUser();
  const email = storedUser?.email ?? '';

  const reset = () => {
    setStep('password');
    setUserId('');
    setPassword('');
    setCode('');
    setError('');
  };

  const complete = (token: string, user: NonNullable<typeof storedUser>) => {
    setAuthData(token, user);
    reset();
    onReAuthenticated();
  };

  const submitPassword = async () => {
    setError('');
    setSubmitting(true);

    try {
      const response = await login(email, password, getDeviceFingerprint());
      if (response.requiresVerification) {
        setUserId(response.userId);
        setStep('verify');
      } else {
        complete(response.token, response.user);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Incorrect password. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitVerification = async () => {
    setError('');
    setSubmitting(true);

    try {
      const response = await verify2FA(
        userId,
        code,
        true,
        getDeviceFingerprint(),
        getDeviceName(),
      );
      complete(response.token, response.user);
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid code. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    if (resending || !userId) return;

    setResending(true);
    setError('');
    try {
      await resend2FA(userId);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to resend code.'));
    } finally {
      setResending(false);
    }
  };

  return {
    step,
    email,
    password,
    setPassword,
    code,
    setCode,
    error,
    submitting,
    resending,
    submitPassword,
    submitVerification,
    resendVerification,
  };
}
