import { Link } from 'react-router-dom';
import { useResetPassword } from './hooks/useResetPassword';
import './ResetPassword.css';

export default function ResetPassword() {
  const { form, error, message, onSubmit, token } = useResetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <div className="reset-password-container">
      <div className="reset-password-card">
        <h1 className="reset-password-title">Reset Password</h1>
        {!token && (
          <p className="reset-password-subtitle">
            Invalid or missing reset token.
          </p>
        )}

        {message && <div className="reset-password-success">{message}</div>}
        {error && <div className="reset-password-error">{error}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="reset-password-form">
          <div className="form-group">
            <label htmlFor="password">New Password</label>
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
            <label htmlFor="confirmPassword">Confirm Password</label>
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
            className="reset-password-submit"
            disabled={isSubmitting || !token}
          >
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="reset-password-links">
          <Link to="/login" className="reset-password-link">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
