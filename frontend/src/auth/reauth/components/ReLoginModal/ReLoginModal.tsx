import PasswordStep from './components/PasswordStep';
import VerificationStep from './components/VerificationStep';
import { useReLogin } from './useReLogin';
import Modal from '../../../../common/components/Modal/Modal';
import './ReLoginModal.css';

interface ReLoginModalProps {
  isOpen: boolean;
  onReAuthenticated: () => void;
}

/**
 * Mounts a fresh re-authentication form while login is required.
 * @param props - Visibility and the callback that releases waiting requests after login.
 * @example <ReLoginModal isOpen={prompting} onReAuthenticated={complete} />
 */
export default function ReLoginModal({ isOpen, onReAuthenticated }: ReLoginModalProps) {
  return isOpen ? <ReLoginForm onReAuthenticated={onReAuthenticated} /> : null;
}

/**
 * Owns the password and verification drafts until re-authentication completes.
 * @param props.onReAuthenticated - Closes this interaction after credentials are stored.
 * @example <ReLoginForm onReAuthenticated={complete} />
 */
function ReLoginForm({ onReAuthenticated }: Pick<ReLoginModalProps, 'onReAuthenticated'>) {
  const reLogin = useReLogin({ onReAuthenticated });

  return (
    <Modal
      isOpen
      onClose={() => undefined}
      title="Session Expired"
      dismissible={false}
      ariaDescribedBy="relogin-description"
      maxWidth="400px"
    >
      <p id="relogin-description" className="relogin-description">Your session has expired. Please enter your password to continue.</p>
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
    </Modal>
  );
}
