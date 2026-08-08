import { ReactNode, useEffect, useRef } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
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
  // Auto-close after successDelay ms when status becomes 'success'. 0 = disabled.
  successDelay?: number;
  // Disable the X close button (e.g. while a request is in-flight)
  disableClose?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '500px',
  status = 'idle',
  statusMessage,
  successDelay = 0,
  disableClose = false,
}: ModalProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  // Keep a ref to onClose so the timer always calls the latest version
  // without needing it as an effect dependency
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (status === 'success' && successDelay > 0) {
      timerRef.current = setTimeout(() => onCloseRef.current(), successDelay);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, successDelay]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal-container"
        style={{ maxWidth }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} disabled={disableClose}>&times;</button>
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
