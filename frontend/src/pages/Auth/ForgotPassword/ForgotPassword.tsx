import { Link } from 'react-router-dom';
import { useForgotPassword } from './hooks/useForgotPassword';
import './ForgotPassword.css';

export default function ForgotPassword() {
  const { form, error, message, onSubmit } = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        <h1 className="forgot-password-title">Forgot Password</h1>
        <p className="forgot-password-subtitle">
          Enter your email to receive a password reset link.
        </p>

        {message && <div className="forgot-password-success">{message}</div>}
        {error && <div className="forgot-password-error">{error}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="forgot-password-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              disabled={isSubmitting}
              {...register('email')}
            />
            {errors.email && (
              <span className="field-error">{errors.email.message}</span>
            )}
          </div>

          <button
            type="submit"
            className="forgot-password-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <div className="forgot-password-links">
          <Link to="/login" className="forgot-password-link">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
