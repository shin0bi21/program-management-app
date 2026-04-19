import { Link } from 'react-router-dom';
import { useResetPassword } from './hooks/useResetPassword';
import AuthLayout from '../../../common/components/AuthLayout/AuthLayout';

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
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register('password')}
            />
            {errors.password && (
              <span className="field-error">{errors.password.message}</span>
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

          <button
            type="submit"
            className="auth-submit"
            disabled={isSubmitting || !token}
          >
            {isSubmitting ? 'Resetting…' : 'Reset password'}
          </button>
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
