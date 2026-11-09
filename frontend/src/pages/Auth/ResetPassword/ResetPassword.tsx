import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import AuthLayout from '../../../common/components/AuthLayout/AuthLayout';
import Button from '../../../common/components/Button/Button';
import { useResetPassword } from './hooks/useResetPassword';

/**
 * Starts a fresh reset interaction for the token in the current URL.
 * @example <ResetPassword /> // reset form for the emailed token
 */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  return <ResetFlow key={token} token={token} />;
}

/**
 * Shows reset completion for one second before returning to login.
 * @param props.token - Token identifying this mounted recovery interaction.
 * @example <ResetFlow token="reset-token" /> // starts with an empty password editor
 */
function ResetFlow({ token }: { token: string }) {
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!submitted) return;

    const timer = setTimeout(() => navigate('/login'), 1000);
    return () => clearTimeout(timer);
  }, [navigate, submitted]);

  return <AuthLayout>
    <div className="auth-card">
      <h1 className="auth-title">Reset password</h1>
      {!token && <div className="auth-error" role="alert">Invalid or missing reset token.</div>}
      {submitted
        ? <div className="auth-success" role="status">Password reset successful</div>
        : <PasswordResetForm token={token} onSuccess={() => setSubmitted(true)} />}
      <div className="auth-links auth-links--centered">
        <Link to="/login" className="auth-link">← Back to login</Link>
      </div>
    </div>
  </AuthLayout>;
}

/**
 * Owns matching password fields until the reset succeeds or this interaction is left.
 * @param props.token - Recovery token supplied by the route.
 * @param props.onSuccess - Unmounts the password editor and starts completion feedback.
 * @example <PasswordResetForm token={token} onSuccess={finishReset} />
 */
function PasswordResetForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const { form, error, onSubmit } = useResetPassword(token, onSuccess);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  return <>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
      <div className="form-group">
        <label htmlFor="newPassword">New password</label>
        <input id="newPassword" type="password" autoComplete="new-password" disabled={isSubmitting} {...register('newPassword')} />
        {errors.newPassword && <span className="field-error">{errors.newPassword.message}</span>}
      </div>
      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm password</label>
        <input id="confirmPassword" type="password" autoComplete="new-password" disabled={isSubmitting} {...register('confirmPassword')} />
        {errors.confirmPassword && <span className="field-error">{errors.confirmPassword.message}</span>}
      </div>
      <Button type="submit" fullWidth disabled={isSubmitting || !token}>
        {isSubmitting ? 'Resetting…' : 'Reset password'}
      </Button>
    </form>
  </>;
}
