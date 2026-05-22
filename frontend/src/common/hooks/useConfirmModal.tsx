import { useState, useEffect, ReactNode } from 'react';
import Button from '../components/Button/Button';
import { getErrorMessage } from '../utils/clientErrors';

interface UseConfirmModalOptions {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  successMessage?: string;
}

export interface UseConfirmModalResult {
  status: 'idle' | 'submitting' | 'success' | 'error';
  statusMessage: string | undefined;
  footer: ReactNode;
  disableClose: boolean;
  successDelay: number;
}

export function useConfirmModal({
  isOpen,
  onConfirm,
  onClose,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  successMessage,
}: UseConfirmModalOptions): UseConfirmModalResult {
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
    setConfirming(true);
    setConfirmError('');
    try {
      await onConfirm();
      if (successMessage) {
        setConfirmSuccess(true);
        // Modal's successDelay timer will call onClose after the success banner
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
