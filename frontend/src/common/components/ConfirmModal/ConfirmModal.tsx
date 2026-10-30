import Modal from '../Modal/Modal';
import { useConfirmModal } from './hooks/useConfirmModal';
import type { ConfirmAction } from './types';

interface ConfirmModalProps {
  action: ConfirmAction | null;
  onClose: () => void;
}

export default function ConfirmModal({ action, onClose }: ConfirmModalProps) {
  const confirmation = useConfirmModal({ action, onClose });

  return <Modal
    isOpen={action !== null}
    onClose={onClose}
    title={action?.title ?? ''}
    status={confirmation.status}
    statusMessage={confirmation.statusMessage}
    footer={confirmation.footer}
  >
    {action && <p>{action.message}</p>}
  </Modal>;
}
