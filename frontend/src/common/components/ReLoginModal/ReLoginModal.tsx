import PasswordStep from './components/PasswordStep';
import VerificationStep from './components/VerificationStep';
import { useReLogin } from './useReLogin';
import './ReLoginModal.css';

interface ReLoginModalProps {
  isOpen: boolean;
  onReAuthenticated: () => void;
}

export default function ReLoginModal({ isOpen, onReAuthenticated }: ReLoginModalProps) {
  const reLogin = useReLogin({ onReAuthenticated });

  if (!isOpen) return null;

  return (
    <div className="relogin-overlay">
      <div
        className="relogin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="relogin-title"
        aria-describedby="relogin-description"
      >
        <div className="relogin-header">
          <h2 id="relogin-title">Session Expired</h2>
          <p id="relogin-description">Your session has expired. Please enter your password to continue.</p>
        </div>

        {reLogin.step === 'password' ? (
          <PasswordStep
            email={reLogin.email}
            password={reLogin.password}
            error={reLogin.error}
            submitting={reLogin.submitting}
            onPasswordChange={reLogin.setPassword}
            onSubmit={reLogin.submitPassword}
          />
        ) : (
          <VerificationStep
            email={reLogin.email}
            code={reLogin.code}
            error={reLogin.error}
            submitting={reLogin.submitting}
            resending={reLogin.resending}
            onCodeChange={reLogin.setCode}
            onSubmit={reLogin.submitVerification}
            onResend={reLogin.resendVerification}
          />
        )}
      </div>
    </div>
  );
}
