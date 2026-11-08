import { Link } from 'react-router-dom';

import AuthLayout from '../../../common/components/AuthLayout/AuthLayout';
import Button from '../../../common/components/Button/Button';

import { useResetPassword } from './hooks/useResetPassword';

/**
 * Displays the recovery-link password form, validation, and reset outcome.
 * @example <ResetPassword /> // reset form for the token in the current URL
 */
export default function ResetPassword() {
  const { form, error, message, onSubmit, token } = useResetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <AuthLayout>
      <div className="auth-card">
        <h1 className="auth-title">Reset password</h1>

        {!token && (
          <div className="auth-error" role="alert">
            Invalid or missing reset token.
          </div>
        )}
        {message && (
          <div className="auth-success" role="status">
            {message}
          </div>
        )}
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          <div className="form-group">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <span className="field-error">{errors.newPassword.message}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <span className="field-error">{errors.confirmPassword.message}</span>
            )}
          </div>

          <Button type="submit" fullWidth disabled={isSubmitting || !token}>
            {isSubmitting ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>

        <div className="auth-links auth-links--centered">
          <Link to="/login" className="auth-link">
            ← Back to login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
