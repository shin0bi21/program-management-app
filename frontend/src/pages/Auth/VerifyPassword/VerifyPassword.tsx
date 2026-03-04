import { useNavigate } from 'react-router-dom';
import { useVerifyPassword } from './hooks/useVerifyPassword';
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
    <div className="verify-container">
      <div className="verify-card">
        <h1 className="verify-title">Verify Password</h1>
        <p className="verify-subtitle">
          Enter the 6-digit verification code from your email.
        </p>

        {error && <div className="verify-error" role="alert">{error}</div>}
        {message && <div className="verify-message">{message}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="verify-form">
          <div className="form-group">
            <label htmlFor="code">Verification Code</label>
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

          <button
            type="submit"
            className="verify-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <div className="verify-timer">
          {timeRemaining > 0 ? (
            <p className="timer">Code expires in {formatTime(timeRemaining)}</p>
          ) : (
            <p className="timer expired">Code has expired</p>
          )}
        </div>

        <div className="verify-actions">
          <button
            type="button"
            className="verify-link"
            onClick={handleResendCode}
            disabled={isResending || resendCooldown > 0}
          >
            {resendCooldown > 0
              ? `Resend available in ${resendCooldown}s`
              : isResending
              ? 'Resending...'
              : 'Resend code'}
          </button>
          <button
            type="button"
            className="verify-link secondary"
            onClick={() => navigate('/login')}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
