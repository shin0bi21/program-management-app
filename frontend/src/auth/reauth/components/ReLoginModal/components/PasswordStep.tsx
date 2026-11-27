import { useForm } from 'react-hook-form';
import Button from '../../../../../common/components/Button/Button';

interface PasswordStepProps {
  email: string;
  error: string;
  onSubmit: (password: string) => void | Promise<void>;
}

export default function PasswordStep({
  email,
  error,
  onSubmit,
}: PasswordStepProps) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { password: '' },
  });

  return (
    <form onSubmit={handleSubmit(({ password }) => onSubmit(password))} className="relogin-form">
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
          {...register('password')}
          placeholder="Enter your password"
          className="relogin-input"
          autoFocus
          required
        />
      </div>

      {error && <p className="relogin-error" role="alert">{error}</p>}

      <Button type="submit" fullWidth disabled={isSubmitting}>
        {isSubmitting ? 'Verifying...' : 'Continue'}
      </Button>
    </form>
  );
}
