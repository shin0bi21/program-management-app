import { ReactNode, useEffect, useId, useRef } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import useModalFocusTrap from './hooks/useModalFocusTrap';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  status?: 'idle' | 'submitting' | 'success' | 'error';
  statusMessage?: string;
  successDelay?: number;
  disableClose?: boolean;
  dismissible?: boolean;
  ariaDescribedBy?: string;
}

/**
 * Displays a dialog that keeps focus inside it and restores focus when it closes.
 * @param props.status - Submission feedback; submitting/success block user dismissal.
 * @param props.statusMessage - Feedback text shown above the dialog content.
 * @param props.successDelay - Milliseconds before closing after success (1000); 0 disables it.
 * @param props.disableClose - Blocks the close button and Escape; callers must also lock custom footer actions.
 * @param props.dismissible - Whether the close button and Escape dismissal are available.
 * @param props.ariaDescribedBy - ID of an existing element describing the dialog.
 * @param props.onClose - Requests closing; the caller changes isOpen or unmounts the dialog.
 * @example <Modal isOpen title="Edit task" onClose={close} status={workflow.status} footer={footer}>{form}</Modal>
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '500px',
  status = 'idle',
  statusMessage,
  successDelay = 1000,
  disableClose = false,
  dismissible = true,
  ariaDescribedBy,
}: ModalProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const titleId = useId();
  const closeDisabled = !dismissible || disableClose || status === 'submitting' || status === 'success';

  // Use the latest close callback without restarting the success countdown.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const containerRef = useModalFocusTrap({ isOpen, disableClose: closeDisabled, onClose });

  useEffect(() => {
    if (isOpen && status === 'success' && successDelay > 0) {
      timerRef.current = setTimeout(() => onCloseRef.current(), successDelay);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, status, successDelay]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        ref={containerRef}
        className="modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        style={{ maxWidth }}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          {dismissible && (
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={onClose}
              disabled={closeDisabled}
            >
              &times;
            </button>
          )}
        </div>

        {status !== 'idle' && (
          <div className={`modal-status modal-status-${status}`} role={status === 'error' ? 'alert' : 'status'}>
            {status === 'submitting' && (
              <div className="modal-status-content">
                <LoadingSpinner size="sm" />
                <span>{statusMessage || 'Submitting...'}</span>
              </div>
            )}
            {status === 'success' && (
              <div className="modal-status-content">
                <span className="modal-status-icon">✓</span>
                <span>{statusMessage || 'Success!'}</span>
              </div>
            )}
            {status === 'error' && statusMessage && (
              <div className="modal-status-content">
                <span className="modal-status-icon">✕</span>
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        )}

        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
