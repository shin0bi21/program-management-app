import { useForm } from 'react-hook-form';
import Button from '../../../../../common/components/Button/Button';

interface VerificationStepProps {
  email: string;
  error: string;
  resending: boolean;
  onSubmit: (code: string) => void | Promise<void>;
  onResend: () => void | Promise<void>;
}

export default function VerificationStep({
  email,
  error,
  resending,
  onSubmit,
  onResend,
}: VerificationStepProps) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { code: '' },
  });

  return (
    <form onSubmit={handleSubmit(({ code }) => onSubmit(code))} className="relogin-form">
      <p className="relogin-hint">
        A verification code was sent to <strong>{email}</strong>.
      </p>

      <div className="relogin-field">
        <label htmlFor="relogin-code">Verification Code</label>
        <input
          id="relogin-code"
          type="text"
          {...register('code')}
          placeholder="6-digit code"
          className="relogin-input"
          maxLength={6}
          autoFocus
          required
        />
      </div>

      {error && <p className="relogin-error" role="alert">{error}</p>}

      <Button type="submit" fullWidth disabled={isSubmitting}>
        {isSubmitting ? 'Verifying...' : 'Verify'}
      </Button>

      <Button type="button" variant="ghost" fullWidth onClick={() => void onResend()} disabled={resending}>
        {resending ? 'Sending...' : 'Resend code'}
      </Button>
    </form>
  );
}
