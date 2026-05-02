import { Link } from 'react-router-dom';
import { useForgotPassword } from './hooks/useForgotPassword';
import AuthLayout from '../../../common/components/AuthLayout/AuthLayout';
import Button from '../../../common/components/Button/Button';

export default function ForgotPassword() {
  const { form, error, message, onSubmit } = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <AuthLayout>
      <div className="auth-card">
        <h1 className="auth-title">Forgot password</h1>

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
            <label htmlFor="email">Email address</label>
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

          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
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
