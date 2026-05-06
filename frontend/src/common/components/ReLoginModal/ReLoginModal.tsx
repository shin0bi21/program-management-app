import { useState } from 'react';
import { getUser, setAuthData } from '../../utils/storage';
import { getDeviceFingerprint, getDeviceName } from '../../utils/deviceFingerprint';
import { login, verify2FA, resend2FA } from '../../../pages/Auth/common/api/auth.api';
import { resolveReLogin } from '../../api/sessionExpired';
import { getErrorMessage } from '../../utils/clientErrors';
import Button from '../Button/Button';
import './ReLoginModal.css';

interface ReLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'password' | 'verify';

export default function ReLoginModal({ isOpen, onClose }: ReLoginModalProps) {
  const [step, setStep] = useState<Step>('password');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const storedUser = getUser();
  const email = storedUser?.email ?? '';

  if (!isOpen) return null;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const deviceFingerprint = getDeviceFingerprint();
      const response = await login(email, password, deviceFingerprint);

      if (response.token) {
        // Trusted device — got token directly, no 2FA needed.
        setAuthData(response.token, response.user ?? storedUser);
        resolveReLogin();
        resetState();
        onClose();
      } else if (response.requiresVerification) {
        setUserId(response.userId);
        setStep('verify');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Incorrect password. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const deviceFingerprint = getDeviceFingerprint();
      const deviceName = getDeviceName();
      const response = await verify2FA(userId, code, true, deviceFingerprint, deviceName);
      setAuthData(response.token, response.user ?? storedUser);
      resolveReLogin();
      resetState();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid code. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
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

  const resetState = () => {
    setStep('password');
    setPassword('');
    setCode('');
    setError('');
    setUserId('');
  };

  return (
    <div className="relogin-overlay">
      <div className="relogin-modal">
        <div className="relogin-header">
          <h2>Session Expired</h2>
          <p>Your session has expired. Please enter your password to continue.</p>
        </div>

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="relogin-form">
            <div className="relogin-field">
              <label>Email</label>
              <input type="email" value={email} disabled className="relogin-input relogin-input--disabled" />
            </div>

            <div className="relogin-field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="relogin-input"
                autoFocus
                required
              />
            </div>

            {error && <p className="relogin-error">{error}</p>}

            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? 'Verifying...' : 'Continue'}
            </Button>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerifySubmit} className="relogin-form">
            <p className="relogin-hint">A verification code was sent to <strong>{email}</strong>.</p>

            <div className="relogin-field">
              <label>Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                className="relogin-input"
                maxLength={6}
                autoFocus
                required
              />
            </div>

            {error && <p className="relogin-error">{error}</p>}

            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? 'Verifying...' : 'Verify'}
            </Button>

            <Button type="button" variant="ghost" fullWidth onClick={handleResend} disabled={resending}>
              {resending ? 'Sending...' : 'Resend code'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
