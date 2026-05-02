import { useNavigate } from 'react-router-dom';
import { useVerifyPassword } from './hooks/useVerifyPassword';
import AuthLayout from '../../../common/components/AuthLayout/AuthLayout';
import Button from '../../../common/components/Button/Button';
import './VerifyPassword.css';

export default function VerifyPassword() {
  const {
    form,
    error,
    message,
    isResending,
    resendCooldown,
    timeRemaining,
    onSubmit,
    handleResendCode,
    formatTime,
  } = useVerifyPassword();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <AuthLayout>
      <div className="auth-card">
        <h1 className="auth-title">Check your email</h1>

        {error && <div className="auth-error" role="alert">{error}</div>}
        {message && <div className="auth-success" role="status">{message}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          <div className="form-group">
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              disabled={isSubmitting}
              {...register('code', {
                onChange: (e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  e.target.value = value;
                },
              })}
            />
            {errors.code && (
              <span className="field-error">{errors.code.message}</span>
            )}
          </div>

          <label className="verify-checkbox">
            <input type="checkbox" {...register('trustDevice')} />
            <span>Remember this device for 30 days</span>
          </label>

          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Verifying…' : 'Verify'}
          </Button>
        </form>

        <div className="verify-footer">
          <p className="verify-timer">
            {timeRemaining > 0
              ? `Code expires in ${formatTime(timeRemaining)}`
              : <span className="verify-timer--expired">Code has expired</span>}
          </p>
          <div className="verify-actions">
            <button
              type="button"
              className="auth-link"
              onClick={handleResendCode}
              disabled={isResending || resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : isResending
                ? 'Resending…'
                : 'Resend code'}
            </button>
            <button
              type="button"
              className="auth-link"
              onClick={() => navigate('/login')}
            >
              ← Back to login
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
