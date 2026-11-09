import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForgotPassword } from './hooks/useForgotPassword';
import AuthLayout from '../../../common/components/AuthLayout/AuthLayout';
import Button from '../../../common/components/Button/Button';

/**
 * Requests a password reset, replacing the completed editor with confirmation.
 * @example <ForgotPassword /> // starts with an empty email field
 */
export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <AuthLayout>
      <div className="auth-card">
        <h1 className="auth-title">Forgot password</h1>

        {submitted
          ? <div className="auth-success" role="status">Password reset email sent</div>
          : <ForgotPasswordForm onSuccess={() => setSubmitted(true)} />}

        <div className="auth-links auth-links--centered">
          <Link to="/login" className="auth-link">
            ← Back to login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

/**
 * Owns one email draft until the request succeeds or the page is left.
 * @param props.onSuccess - Unmounts this editor and shows confirmation.
 * @example <ForgotPasswordForm onSuccess={showConfirmation} />
 */
function ForgotPasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const { form, error, onSubmit } = useForgotPassword(onSuccess);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  return <>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
      <div className="form-group">
        <label htmlFor="email">Email address</label>
        <input id="email" type="email" autoComplete="email" autoFocus disabled={isSubmitting} {...register('email')} />
        {errors.email && <span className="field-error">{errors.email.message}</span>}
      </div>
      <Button type="submit" fullWidth disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  </>;
}
