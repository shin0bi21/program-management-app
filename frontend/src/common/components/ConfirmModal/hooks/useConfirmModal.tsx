import {
  useEffect,
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

export function useConfirmModal({
  action,
  onClose,
}: {
  action: ConfirmAction | null;
  onClose: () => void;
}): UseConfirmModalResult {
  const isOpen = action !== null;
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const confirmingRef = useRef(false);

  useEffect(() => {
    confirmingRef.current = false;
    setConfirming(false);
    setConfirmError('');
    setConfirmSuccess(false);
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!action || confirmingRef.current) return;

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

  const confirmVariant = action?.confirmVariant ?? 'primary';
  const successMessage = action?.successMessage;

  const statusMessage = confirmSuccess
    ? successMessage
    : confirmError || undefined;

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={confirming}>Cancel</Button>
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
