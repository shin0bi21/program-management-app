import { useState, useRef, useEffect, useLayoutEffect, useCallback, type RefObject } from 'react';
import {
  calculateFloatingPosition,
  calculateFloatingPositionFromRect,
  calculateFloatingPositionFromPoint,
  type Placement,
  type FloatingPosition,
  type PlacementOptions,
} from '../utils/floatingPosition';
import { getMenuItems } from '../utils/floatingMenuUtils';
import useViewportDismissal from './useViewportDismissal';

export interface UseFloatingMenuOptions extends PlacementOptions {
  /**
   * CSS selector queried on triggerRef.current to find the focusable element
   * to return focus to on close. Use when triggerRef is on a wrapper element
   * (e.g. a <span>) rather than directly on the focusable element.
   * Example: 'button'
   */
  returnFocusSelector?: string;
  /** Keep the menu open through viewport changes caused by its own interaction. */
  dismissOnViewportChange?: boolean;
}

export interface UseFloatingMenuReturn {
  isOpen: boolean;
  open: () => void;
  openAtRect: (rect: DOMRect) => void;
  openAtPoint: (x: number, y: number) => void;
  close: () => void;
  toggle: () => void;
  position: FloatingPosition | null;
  menuRef: RefObject<HTMLDivElement | null>;
}

export function useFloatingMenu(
  triggerRef: RefObject<HTMLElement | null>,
  placement: Placement = { side: 'bottom', align: 'start' },
  options: UseFloatingMenuOptions = {},
): UseFloatingMenuReturn {
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep placement and options in refs so open/toggle never go stale
  // even when callers pass inline object literals.
  const placementRef = useRef(placement);
  const optionsRef = useRef(options);
  placementRef.current = placement;
  optionsRef.current = options;

  // isOpen as a ref so toggle never captures a stale snapshot
  const isOpenRef = useRef(false);
  const anchorRectRef = useRef<DOMRect | null>(null);
  const anchorPointRef = useRef<{ x: number; y: number } | null>(null);
  const isOpen = position !== null;
  isOpenRef.current = isOpen;

  const close = useCallback(() => {
    anchorRectRef.current = null;
    anchorPointRef.current = null;
    setPosition(null);
  }, []);
  useViewportDismissal(
    isOpen && options.dismissOnViewportChange !== false,
    close,
    menuRef,
  );

  const open = useCallback(() => {
    if (!triggerRef.current) return;
    anchorRectRef.current = null;
    anchorPointRef.current = null;
    setPosition(
      calculateFloatingPosition(triggerRef.current, placementRef.current, optionsRef.current),
    );
  }, [triggerRef]);

  const openAtRect = useCallback((rect: DOMRect) => {
    anchorRectRef.current = rect;
    anchorPointRef.current = null;
    setPosition(calculateFloatingPositionFromRect(rect, placementRef.current, optionsRef.current));
  }, []);

  const openAtPoint = useCallback((x: number, y: number) => {
    anchorRectRef.current = null;
    anchorPointRef.current = { x, y };
    setPosition(calculateFloatingPositionFromPoint(x, y, placementRef.current, optionsRef.current));
  }, []);

  const toggle = useCallback(() => {
    if (isOpenRef.current) close();
    else open();
  }, [close, open]);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const menuRect = menu.getBoundingClientRect();
    const measuredOptions = {
      ...optionsRef.current,
      widthEstimate: menuRect.width || optionsRef.current.widthEstimate,
      heightEstimate: menuRect.height || optionsRef.current.heightEstimate,
    };
    let measuredPosition: FloatingPosition;
    if (anchorRectRef.current) {
      measuredPosition = calculateFloatingPositionFromRect(anchorRectRef.current, placementRef.current, measuredOptions);
    } else if (anchorPointRef.current) {
      measuredPosition = calculateFloatingPositionFromPoint(anchorPointRef.current.x, anchorPointRef.current.y, placementRef.current, measuredOptions);
    } else {
      measuredPosition = calculateFloatingPosition(trigger, placementRef.current, measuredOptions);
    }

    setPosition(current => current
      && current.top === measuredPosition.top
      && current.left === measuredPosition.left
      ? current
      : measuredPosition);
  }, [triggerRef]);

  // Dismiss pointer interactions outside. Viewport dismissal is shared by floating UI consumers.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('.floating-menu-panel')) return;
      close();
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, close, triggerRef]);

  // Measure once before paint, then respond only when the trigger or portalled
  // menu changes size instead of measuring after every render.
  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return undefined;

    reposition();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(reposition);
    observer.observe(trigger);
    observer.observe(menu);
    return () => observer.disconnect();
  }, [isOpen, reposition, triggerRef]);

  // Focus management: first item on open; return focus to trigger on close
  useLayoutEffect(() => {
    if (!isOpen) return;

    const trigger = triggerRef.current;
    getMenuItems(menuRef.current)[0]?.focus();

    return () => {
      if (!trigger) return;
      const { returnFocusSelector } = optionsRef.current;
      const returnTarget = returnFocusSelector
        ? trigger.querySelector<HTMLElement>(returnFocusSelector)
        : trigger;
      returnTarget?.focus();
    };
  }, [isOpen, triggerRef]);

  return { isOpen, open, openAtRect, openAtPoint, close, toggle, position, menuRef };
}
