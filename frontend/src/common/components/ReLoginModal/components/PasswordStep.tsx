import type { FormEvent } from 'react';
import Button from '../../Button/Button';

interface PasswordStepProps {
  email: string;
  password: string;
  error: string;
  submitting: boolean;
  onPasswordChange: (password: string) => void;
  onSubmit: () => void | Promise<void>;
}

export default function PasswordStep({
  email,
  password,
  error,
  submitting,
  onPasswordChange,
  onSubmit,
}: PasswordStepProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="relogin-form">
      <div className="relogin-field">
        <label htmlFor="relogin-email">Email</label>
        <input
          id="relogin-email"
          type="email"
          value={email}
          disabled
          className="relogin-input relogin-input--disabled"
        />
      </div>

      <div className="relogin-field">
        <label htmlFor="relogin-password">Password</label>
        <input
          id="relogin-password"
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
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
  );
}
