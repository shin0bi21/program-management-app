import type { FormEvent } from 'react';
import Button from '../../../../../common/components/Button/Button';

interface VerificationStepProps {
  email: string;
  code: string;
  error: string;
  submitting: boolean;
  resending: boolean;
  onCodeChange: (code: string) => void;
  onSubmit: () => void | Promise<void>;
  onResend: () => void | Promise<void>;
}

export default function VerificationStep({
  email,
  code,
  error,
  submitting,
  resending,
  onCodeChange,
  onSubmit,
  onResend,
}: VerificationStepProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="relogin-form">
      <p className="relogin-hint">
        A verification code was sent to <strong>{email}</strong>.
      </p>

      <div className="relogin-field">
        <label htmlFor="relogin-code">Verification Code</label>
        <input
          id="relogin-code"
          type="text"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="6-digit code"
          className="relogin-input"
          maxLength={6}
          autoFocus
          required
        />
      </div>

      {error && <p className="relogin-error" role="alert">{error}</p>}

      <Button type="submit" fullWidth disabled={submitting}>
        {submitting ? 'Verifying...' : 'Verify'}
      </Button>

      <Button type="button" variant="ghost" fullWidth onClick={() => void onResend()} disabled={resending}>
        {resending ? 'Sending...' : 'Resend code'}
      </Button>
    </form>
  );
}
