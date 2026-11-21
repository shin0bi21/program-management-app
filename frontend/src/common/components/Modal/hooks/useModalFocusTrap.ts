import { useEffect, useRef, type RefObject } from 'react';

interface UseModalFocusTrapOptions {
  isOpen: boolean;
}

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Focuses an open dialog, wraps its Tab navigation, and restores its opener on cleanup.
 * @example Tab on the final control returns focus to the first control in the dialog.
 */
export default function useModalFocusTrap({ isOpen }: UseModalFocusTrapOptions): RefObject<HTMLDivElement> {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return undefined;

    const getFocusableItems = () => Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );

    getFocusableItems()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const openDialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      if (openDialogs[openDialogs.length - 1] !== container) return;

      if (event.key !== 'Tab' || event.defaultPrevented) return;
      const items = getFocusableItems();
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  return containerRef;
}
