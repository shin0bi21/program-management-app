import { useState, useEffect, ReactNode } from 'react';
import Button from '../components/Button/Button';
import { getErrorMessage } from '../utils/clientErrors';

export interface ConfirmAction {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  successMessage?: string;
  onConfirm: () => Promise<void>;
}

export interface UseConfirmModalResult {
  status: 'idle' | 'submitting' | 'success' | 'error';
  statusMessage: string | undefined;
  footer: ReactNode;
  disableClose: boolean;
  successDelay: number;
}

export function useConfirmModal({
  action,
  onClose,
}: {
  action: ConfirmAction | null;
  onClose: () => void;
}): UseConfirmModalResult {
  const isOpen = !!action;
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirming(false);
      setConfirmError('');
      setConfirmSuccess(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!action) return;
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
      setConfirming(false);
    }
  };

  let status: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
  if (confirmSuccess) status = 'success';
  else if (confirming) status = 'submitting';
  else if (confirmError) status = 'error';

  const confirmLabel = action?.confirmLabel ?? 'Confirm';
  const confirmVariant = action?.confirmVariant ?? 'primary';
  const successMessage = action?.successMessage;

  const statusMessage = confirmSuccess
    ? successMessage
    : confirmError || undefined;

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={confirming}>Cancel</Button>
      <Button variant={confirmVariant} onClick={handleConfirm} disabled={confirming || confirmSuccess}>
        {confirming ? 'Please wait...' : confirmLabel}
      </Button>
    </>
  );

  return {
    status,
    statusMessage,
    footer,
    disableClose: confirming,
    successDelay: successMessage ? 1200 : 0,
  };
}
