import { useState } from 'react';
import { login, resend2FA, verify2FA } from '../../../auth.api';
import { getDeviceFingerprint, getDeviceName } from '../../../deviceFingerprint';
import { getErrorMessage } from '../../../../http/errors';
import { getUser, setAuthData } from '../../../storage';

export type ReLoginStep = 'password' | 'verify';

interface UseReLoginOptions {
  onReAuthenticated: () => void;
}

/**
 * Owns the credentials and verification step for one mounted login interaction.
 * @param options.onReAuthenticated - Releases waiting requests and unmounts the form after login.
 * @example useReLogin({ onReAuthenticated: complete }) // starts with an empty password
 */
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

  /**
   * Stores the new credentials and completes the mounted interaction.
   * @param token - Fresh access token returned by authentication.
   * @param user - Authenticated account returned with the token.
   * @example complete(token, user) // resumes requests waiting for login
   */
  const complete = (token: string, user: NonNullable<typeof storedUser>) => {
    setAuthData(token, user);
    onReAuthenticated();
  };

  /** Checks the password and opens verification when required. @example await submitPassword() */
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

  /** Verifies the code and completes login. @example await submitVerification() */
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

  /** Requests another code for the active verification step. @example await resendVerification() */
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
