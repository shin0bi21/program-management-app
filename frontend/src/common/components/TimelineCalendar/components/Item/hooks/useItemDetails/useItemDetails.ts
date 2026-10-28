import { useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import useViewportDismissal from '../../../../../FloatingMenu/hooks/useViewportDismissal';
import { calculateFloatingPositionFromRect, type FloatingPosition } from '../../../../../FloatingMenu/utils/floatingPosition';
import { getVisibleItemAnchor } from '../../utils/getVisibleItemAnchor';

const HOVER_DETAILS_DELAY_MS = 120;

export default function useItemDetails(triggerRef: RefObject<HTMLButtonElement | null>) {
  const detailRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<DOMRect | null>(null);
  const sizeRef = useRef<{ width: number; height: number } | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const [pending, setPending] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const isOpen = position !== null;

  const cancelPendingDetails = () => {
    if (openTimerRef.current === null) return;

    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  };

  const hideDetails = () => {
    cancelPendingDetails();

    anchorRef.current = null;
    setPending(false);
    setPosition(null);
  };

  useViewportDismissal(isOpen || pending, hideDetails);

  const showDetails = (clientX?: number) => {
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
  };

  const onMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    cancelPendingDetails();

    const clientX = event.clientX;
    setPending(true);
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      showDetails(clientX);
    }, HOVER_DETAILS_DELAY_MS);
  };

  const onFocus = () => {
    if (triggerRef.current?.matches(':focus-visible')) showDetails();
  };

  useLayoutEffect(() => () => {
    if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    const detail = detailRef.current;

    if (!isOpen || !detail) return undefined;

    const reposition = () => {
      const anchor = anchorRef.current;

      if (!anchor) return;

      const bounds = detail.getBoundingClientRect();
      sizeRef.current = { width: bounds.width, height: bounds.height };
      const next = calculateFloatingPositionFromRect(
        anchor,
        { side: 'bottom', align: 'start' },
        { widthEstimate: bounds.width, heightEstimate: bounds.height, offset: 8 },
      );

      setPosition(current => current?.top === next.top && current.left === next.left ? current : next);
    };

    reposition();

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(reposition);
    observer.observe(detail);

    return () => observer.disconnect();
  }, [isOpen]);

  return { detailRef, position, showDetails, hideDetails, onMouseEnter, onFocus };
}
