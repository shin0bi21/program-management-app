import { useEffect, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { FloatingPosition } from './utils/floatingPosition';
import { getMenuItems } from './utils/floatingMenuUtils';
import './FloatingMenuPanel.css';

interface FloatingMenuPanelProps {
  menuRef: RefObject<HTMLDivElement | null>;
  position: FloatingPosition;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  width?: number;
  keyboardMode?: 'menu' | 'form';
  ariaLabel?: string;
}

export default function FloatingMenuPanel({
  menuRef,
  position,
  onClose,
  children,
  className,
  width,
  keyboardMode = 'menu',
  ariaLabel,
}: FloatingMenuPanelProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (keyboardMode === 'form' && event.key !== 'Escape') {
        if (event.key === 'Tab') {
          const controls = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
          const boundary = event.shiftKey ? controls[0] : controls[controls.length - 1];
          if (document.activeElement === boundary) onClose();
        }
        return;
      }

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
  }, [keyboardMode, menuRef, onClose]);

  return createPortal(
    <div
      ref={menuRef as unknown as RefObject<HTMLDivElement>}
      role={keyboardMode === 'form' ? 'dialog' : 'menu'}
      aria-label={ariaLabel}
      className={`floating-menu-panel${className ? ` ${className}` : ''}`}
      style={{ top: position.top, left: position.left, width }}
      onPointerDown={event => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
