import { useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import useViewportDismissal from '../../../../../FloatingMenu/hooks/useViewportDismissal';
import { calculateFloatingPositionFromRect, type FloatingPosition } from '../../../../../FloatingMenu/utils/floatingPosition';
import { getVisibleItemAnchor } from '../../utils/getVisibleItemAnchor';

const HOVER_DETAILS_DELAY_MS = 120;

/**
 * Owns delayed hover and focus details, their visible anchor, and dismissal cleanup.
 * Requires: the trigger ref points to the item button while it is mounted.
 * Example: hovering an item opens details after 120 ms; leaving cancels pending details.
 */
export default function useItemDetails(triggerRef: RefObject<HTMLButtonElement | null>) {
  const detailRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<DOMRect | null>(null);
  const sizeRef = useRef<{ width: number; height: number } | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const [pending, setPending] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const isOpen = position !== null;

  /** Schedules hover details, replacing any earlier pending hover. */
  function scheduleDetails(event: MouseEvent<HTMLButtonElement>): void {
    cancelPendingDetails();

    const clientX = event.clientX;
    setPending(true);
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      showDetails(clientX);
    }, HOVER_DETAILS_DELAY_MS);
  }

  /** Opens details against the visible part of the item under the pointer. */
  function showDetails(clientX?: number): void {
    cancelPendingDetails();
    setPending(false);

    const anchor = getVisibleItemAnchor(triggerRef.current, clientX);

    if (!anchor) return;

    anchorRef.current = anchor;

    const measuredSize = sizeRef.current;
    const next = calculateFloatingPositionFromRect(
      anchor,
      { side: 'bottom', align: 'start' },
      {
        widthEstimate: measuredSize?.width ?? 300,
        heightEstimate: measuredSize?.height ?? 190,
        offset: 8,
      },
    );

    setPosition(current => current?.top === next.top && current.left === next.left ? current : next);
  }

  /** Opens immediate details only for a keyboard-visible focus state. */
  function showFocusedDetails(): void {
    if (triggerRef.current?.matches(':focus-visible')) showDetails();
  }

  /** Closes visible details and cancels pending hover work. */
  function hideDetails(): void {
    cancelPendingDetails();

    anchorRef.current = null;
    setPending(false);
    setPosition(null);
  }

  /** Cancels a pending timer without changing already-visible details. */
  function cancelPendingDetails(): void {
    if (openTimerRef.current === null) return;

    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  }

  useViewportDismissal(isOpen || pending, hideDetails);

  useLayoutEffect(function observeDetailsLifetime() {
    return function stopPendingDetails() {
      if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
    };
  }, []);

  useLayoutEffect(function observeDetailsSize() {
    const detail = detailRef.current;

    if (!isOpen || !detail) return undefined;

    const observedDetail = detail;

    /** Repositions after the portal has been measured or resized. */
    function repositionDetails(): void {
      const anchor = anchorRef.current;

      if (!anchor) return;

      const bounds = observedDetail.getBoundingClientRect();
      sizeRef.current = { width: bounds.width, height: bounds.height };
      const next = calculateFloatingPositionFromRect(
        anchor,
        { side: 'bottom', align: 'start' },
        { widthEstimate: bounds.width, heightEstimate: bounds.height, offset: 8 },
      );

      setPosition(current => current?.top === next.top && current.left === next.left ? current : next);
    }

    repositionDetails();

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(repositionDetails);
    observer.observe(observedDetail);

    return () => observer.disconnect();
  }, [isOpen]);

  return { detailRef, position, showDetails, hideDetails, onMouseEnter: scheduleDetails, onFocus: showFocusedDetails };
}
