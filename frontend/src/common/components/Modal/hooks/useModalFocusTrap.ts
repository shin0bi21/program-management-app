import { useEffect, useRef } from 'react';

interface UseModalFocusTrapOptions {
  isOpen: boolean;
  disableClose: boolean;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export default function useModalFocusTrap({
  isOpen,
  disableClose,
  onClose,
}: UseModalFocusTrapOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const disableCloseRef = useRef(disableClose);
  const onCloseRef = useRef(onClose);
  disableCloseRef.current = disableClose;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const getFocusableItems = () => Array.from(
      container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    );

    getFocusableItems()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const openDialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      if (openDialogs[openDialogs.length - 1] !== container) return;

      if (event.key === 'Escape') {
        if (!disableCloseRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== 'Tab') return;
      const items = getFocusableItems();
      if (items.length === 0) {
        event.preventDefault();
        container?.focus();
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

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  return containerRef;
}
