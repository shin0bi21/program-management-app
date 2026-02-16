import { ReactNode } from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  maxWidth?: string;
  status?: 'idle' | 'submitting' | 'success' | 'error';
  statusMessage?: string;
}

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer, 
  maxWidth = '500px',
  status = 'idle',
  statusMessage
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div 
        className="modal-container" 
        style={{ maxWidth }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        {/* Status indicator */}
        {status !== 'idle' && (
          <div className={`modal-status modal-status-${status}`}>
            {status === 'submitting' && (
              <div className="modal-status-content">
                <span className="modal-spinner"></span>
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
        <div className="modal-footer">
          {footer}
        </div>
      </div>
    </div>
  );
}
