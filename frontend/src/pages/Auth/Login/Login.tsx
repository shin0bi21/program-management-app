import { Link } from 'react-router-dom';
import { useLogin } from './hooks/useLogin';
import AuthLayout from '../../../common/components/AuthLayout/AuthLayout';

export default function Login() {
  const { form, error, onSubmit } = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <AuthLayout>
      <div className="auth-card">
        <p className="auth-card-kicker">Welcome back</p>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">Enter your credentials to continue.</p>

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

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              {...register('password')}
            />
            {errors.password && (
              <span className="field-error">{errors.password.message}</span>
            )}
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password" className="auth-link">
            Forgot password?
          </Link>
          <Link to="/" className="auth-link">
            ← Back to home
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
