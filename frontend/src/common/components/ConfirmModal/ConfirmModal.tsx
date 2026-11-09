import Modal from '../Modal/Modal';
import { useConfirmModal } from './hooks/useConfirmModal';
import type { ConfirmAction } from './types';

interface ConfirmModalProps {
  action: ConfirmAction | null;
  onClose: () => void;
}

/**
 * Asks the user to confirm an action and shows its progress and result.
 * Successful actions close immediately, or after one second when a success message is supplied.
 * @param props.action - Operation to confirm, including its title/message; null closes the dialog.
 * @param props.onClose - Requests dismissal; the caller clears the pending action.
 * @example <ConfirmModal action={{ title: 'Delete task', message: 'Delete this task?', onConfirm: deleteTask }} onClose={clearAction} />
 */
export default function ConfirmModal({ action, onClose }: ConfirmModalProps) {
  return action ? <Confirmation action={action} onClose={onClose} /> : null;
}

/**
 * Owns feedback and submission for one mounted confirmation.
 * @param props - Active action and the callback that clears it to unmount this interaction.
 * @example <Confirmation action={deleteAction} onClose={clearAction} />
 */
function Confirmation({ action, onClose }: { action: ConfirmAction; onClose: () => void }) {
  const confirmation = useConfirmModal({ action, onClose });

  return <Modal
    isOpen
    onClose={onClose}
    title={action.title}
    status={confirmation.status}
    statusMessage={confirmation.statusMessage}
    footer={confirmation.footer}
  >
    <p>{action.message}</p>
  </Modal>;
}
