import PasswordStep from './components/PasswordStep';
import VerificationStep from './components/VerificationStep';
import { useReLogin } from './useReLogin';
import Modal from '../../../../common/components/Modal/Modal';
import './ReLoginModal.css';

interface ReLoginModalProps {
  isOpen: boolean;
  onReAuthenticated: () => void;
}

export default function ReLoginModal({ isOpen, onReAuthenticated }: ReLoginModalProps) {
  const reLogin = useReLogin({ onReAuthenticated });

  return (
    <Modal
      isOpen={isOpen}
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
