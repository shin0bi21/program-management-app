import {
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Button from '../../Button/Button';
import { getErrorMessage } from '../../../../http/errors';
import type { ConfirmAction } from '../types';

export interface UseConfirmModalResult {
  status: 'idle' | 'submitting' | 'success' | 'error';
  statusMessage: string | undefined;
  footer: ReactNode;
}

/**
 * Confirms one mounted action and exposes its feedback until dismissal.
 * @param options - Supplied active action and callback that unmounts the interaction.
 * @example useConfirmModal({ action: deleteAction, onClose: clearAction })
 */
export function useConfirmModal({
  action,
  onClose,
}: {
  action: ConfirmAction;
  onClose: () => void;
}): UseConfirmModalResult {
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const confirmingRef = useRef(false);

  /** Executes the action once and keeps failure available for retry. @example await handleConfirm() */
  const handleConfirm = async () => {
    if (confirmingRef.current) return;

    confirmingRef.current = true;
    setConfirming(true);
    setConfirmError('');

    try {
      await action.onConfirm();
      if (action.successMessage) {
        setConfirmSuccess(true);
      } else {
        onClose();
      }
    } catch (err) {
      setConfirmError(getErrorMessage(err, 'Action failed'));
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  let status: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
  if (confirmSuccess) status = 'success';
  else if (confirming) status = 'submitting';
  else if (confirmError) status = 'error';

  const confirmVariant = action.confirmVariant ?? 'primary';
  const successMessage = action.successMessage;

  const statusMessage = confirmSuccess
    ? successMessage
    : confirmError || undefined;

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={confirming || confirmSuccess}>Cancel</Button>
      <Button variant={confirmVariant} onClick={handleConfirm} disabled={confirming || confirmSuccess}>
        Confirm
      </Button>
    </>
  );

  return {
    status,
    statusMessage,
    footer,
  };
}
