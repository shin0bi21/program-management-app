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

/**
 * Owns item action-menu opening, action completion, and touch detail access.
 * Requires: triggerRef identifies the item button.
 * Example: activating an item opens actions after any selection-driven layout change.
 */
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

  /** Closes an open menu or queues opening after the item selection update. */
  function toggleMenu(event: MouseEvent<HTMLButtonElement>): void {
    hideDetails();

    if (!hasActions) return;

    if (isOpen) {
      close();
      return;
    }

    setPendingAnchorX(event.clientX);
  }

  /** Closes the menu before invoking an action without activating the containing item. */
  function runAction(event: MouseEvent<HTMLButtonElement>, action: () => void): void {
    event.stopPropagation();
    close();
    action();
  }

  /** Replaces the touch action menu with item details. */
  function viewDetails(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    close();
    showDetails();
  }

  useLayoutEffect(function openMenuAfterSelection() {
    if (pendingAnchorX === null) return;

    // Selection may change the layout above the calendar during the opening click.
    const anchor = getVisibleItemAnchor(triggerRef.current, pendingAnchorX);
    setPendingAnchorX(null);

    if (anchor) openAtRect(anchor);
  }, [pendingAnchorX, openAtRect, triggerRef]);

  return { isOpen, close, position, menuRef, showTouchDetails, onClick: toggleMenu, runAction, viewDetails };
}
