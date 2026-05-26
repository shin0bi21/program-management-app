import { useEffect, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { FloatingPosition } from '../../utils/floatingPosition';
import { getMenuItems } from '../../utils/floatingMenuUtils';
import './FloatingMenuPanel.css';

interface FloatingMenuPanelProps {
  menuRef: RefObject<HTMLDivElement | null>;
  position: FloatingPosition;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export default function FloatingMenuPanel({
  menuRef,
  position,
  onClose,
  children,
  className,
}: FloatingMenuPanelProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab') {
        onClose();
        return;
      }

      const items = getMenuItems(menuRef.current);
      if (items.length === 0) return;

      const current = items.indexOf(document.activeElement as HTMLElement);
      let next: number | null = null;

      if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
      else if (event.key === 'ArrowUp') next = current <= 0 ? items.length - 1 : current - 1;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = items.length - 1;

      if (next !== null) {
        event.preventDefault();
        items[next].focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuRef, onClose]);

  return createPortal(
    <div
      ref={menuRef as unknown as RefObject<HTMLDivElement>}
      role="menu"
      className={`floating-menu-panel${className ? ` ${className}` : ''}`}
      style={{ top: position.top, left: position.left }}
    >
      {children}
    </div>,
    document.body,
  );
}
