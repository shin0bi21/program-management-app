import { useState, useRef, useEffect, useLayoutEffect, useCallback, type RefObject } from 'react';
import {
  calculateFloatingPosition,
  type Placement,
  type FloatingPosition,
  type PlacementOptions,
} from '../utils/floatingPosition';
import { getMenuItems } from '../utils/floatingMenuUtils';

export interface UseFloatingMenuOptions extends PlacementOptions {
  /**
   * CSS selector queried on triggerRef.current to find the focusable element
   * to return focus to on close. Use when triggerRef is on a wrapper element
   * (e.g. a <span>) rather than directly on the focusable element.
   * Example: 'button'
   */
  returnFocusSelector?: string;
}

export interface UseFloatingMenuReturn {
  isOpen: boolean;
  open: () => void;
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
  const isOpen = position !== null;
  isOpenRef.current = isOpen;

  const close = useCallback(() => {
    setPosition(null);
  }, []);

  const open = useCallback(() => {
    if (!triggerRef.current) return;
    setPosition(
      calculateFloatingPosition(triggerRef.current, placementRef.current, optionsRef.current),
    );
  }, [triggerRef]);

  const toggle = useCallback(() => {
    if (isOpenRef.current) close();
    else open();
  }, [close, open]);

  // Dismiss: pointerdown outside, scroll, resize
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    window.addEventListener('resize', close, { passive: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', close, { capture: true });
      window.removeEventListener('resize', close);
    };
  }, [isOpen, close, triggerRef]);

  // Focus management: first item on open; return focus to trigger on close
  useLayoutEffect(() => {
    if (!isOpen) return;

    getMenuItems(menuRef.current)[0]?.focus();

    return () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const { returnFocusSelector } = optionsRef.current;
      const returnTarget = returnFocusSelector
        ? trigger.querySelector<HTMLElement>(returnFocusSelector)
        : trigger;
      returnTarget?.focus();
    };
  }, [isOpen, triggerRef]);

  return { isOpen, open, close, toggle, position, menuRef };
}
