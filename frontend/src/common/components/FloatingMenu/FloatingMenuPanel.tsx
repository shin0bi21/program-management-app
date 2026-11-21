import { type KeyboardEvent, type ReactElement, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { FloatingPosition } from './utils/floatingPosition';
import { getMenuItems } from './utils/floatingMenuUtils';
import './FloatingMenuPanel.css';

interface FloatingMenuPanelProps {
  menuRef: RefObject<HTMLDivElement>;
  position: FloatingPosition;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  width?: number;
  keyboardMode?: 'menu' | 'form';
  ariaLabel?: string;
}

/**
 * Displays a floating menu or form in document.body while mounted.
 * Escape closes only this panel and stops propagation to enclosing popups or modals.
 * Pair with useFloatingMenu for placement, outside clicks, and focus return; mount only while open.
 * @param props.position - Fixed top/left coordinates in CSS pixels; width uses the same units.
 * @param props.keyboardMode - Menu arrows/Home/End, or native form keys with Tab dismissal at the first/last enabled button or input.
 * @param props.ariaLabel - Accessible name for the panel, particularly a form-mode dialog.
 * @example
 * <FloatingMenuPanel menuRef={menuRef} position={{ top: 24, left: 48 }} onClose={close}>
 *   <button role="menuitem">Archive</button>
 * </FloatingMenuPanel>
 */
export default function FloatingMenuPanel({
  menuRef,
  position,
  onClose,
  children,
  className,
  width,
  keyboardMode = 'menu',
  ariaLabel,
}: FloatingMenuPanelProps): ReactElement {
  /**
   * Handles keys bubbling from this panel, leaving unhandled form keys to their controls.
   * @example Escape closes this panel without dismissing its parent modal.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (keyboardMode === 'form') {
      if (event.key === 'Tab') {
        const controls = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [],
        );
        const boundary = event.shiftKey ? controls[0] : controls[controls.length - 1];
        if (document.activeElement === boundary) onClose();
      }
      return;
    }

    if (event.key === 'Tab') {
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
      event.stopPropagation();
      items[next].focus();
    }
  };

  return createPortal(
    <div
      ref={menuRef}
      role={keyboardMode === 'form' ? 'dialog' : 'menu'}
      aria-label={ariaLabel}
      className={`floating-menu-panel${className ? ` ${className}` : ''}`}
      style={{ top: position.top, left: position.left, width }}
      onKeyDown={handleKeyDown}
      onPointerDown={event => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
