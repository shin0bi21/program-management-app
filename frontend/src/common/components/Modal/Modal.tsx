import { ReactNode } from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth = '500px' }: ModalProps) {
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
