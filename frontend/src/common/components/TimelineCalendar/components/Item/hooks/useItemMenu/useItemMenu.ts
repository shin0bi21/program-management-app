import { useLayoutEffect, useState, type MouseEvent, type RefObject } from 'react';
import { useFloatingMenu } from '../../../../../FloatingMenu/hooks/useFloatingMenu';
import { getVisibleItemAnchor } from '../../utils/getVisibleItemAnchor';

const PRECISE_HOVER_QUERY = '(hover: hover) and (pointer: fine)';

interface UseItemMenuOptions {
  triggerRef: RefObject<HTMLButtonElement | null>;
  hasActions: boolean;
  hideDetails: () => void;
  showDetails: () => void;
}

export default function useItemMenu({ triggerRef, hasActions, hideDetails, showDetails }: UseItemMenuOptions) {
  const [pendingAnchorX, setPendingAnchorX] = useState<number | null>(null);
  const { isOpen, openAtRect, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'start' },
    { widthEstimate: 150, heightEstimate: 86 },
  );
  const supportsPreciseHover = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(PRECISE_HOVER_QUERY).matches;
  const showTouchDetails = isOpen && !supportsPreciseHover;

  useLayoutEffect(() => {
    if (pendingAnchorX === null) return;

    // Selection may change the layout above the calendar during the opening click.
    const anchor = getVisibleItemAnchor(triggerRef.current, pendingAnchorX);
    setPendingAnchorX(null);
    if (anchor) openAtRect(anchor);
  }, [pendingAnchorX, openAtRect, triggerRef]);

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    hideDetails();

    if (!hasActions) return;

    if (isOpen) {
      close();
      return;
    }

    setPendingAnchorX(event.clientX);
  };

  const runAction = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation();
    close();
    action();
  };

  const viewDetails = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    close();
    showDetails();
  };

  return { isOpen, close, position, menuRef, showTouchDetails, onClick, runAction, viewDetails };
}
