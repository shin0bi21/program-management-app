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
   * Selector for the control that receives focus when the trigger ref points to a wrapper.
   * @example 'button' returns focus to the wrapper's button when the popup closes.
   */
  returnFocusSelector?: string;
  /** Close on external scrolling or window resizing by default; false disables both. */
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
  menuRef: RefObject<HTMLDivElement>;
}

/**
 * Opens and positions a floating popup, closes it on outside clicks, and returns focus to its trigger.
 * Render the panel with menuRef while open to measure its size and focus its first enabled menu item.
 * @param triggerRef - Button (or wrapper) that opens the popup and receives focus when it closes.
 * @param placement - Which side of the trigger and which alignment to use.
 * @param options - Estimated popup size, focus target, and whether scrolling/resizing dismisses it.
 * @returns Open/close controls, popup coordinates, and the ref passed to FloatingMenuPanel.
 * @example open() places a default popup below the trigger; close() returns focus to that trigger.
 */
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

  /**
   * Hides the popup and clears its temporary point/rectangle anchor.
   * @example Closing a context menu lets the next normal open use the trigger again.
   */
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

  /**
   * Opens beside the trigger using current placement and size estimates; ignores a missing trigger.
   * @example The default placement opens below the button, aligned to its starting edge.
   */
  const open = useCallback(() => {
    if (!triggerRef.current) return;

    anchorRectRef.current = null;
    anchorPointRef.current = null;
    setPosition(
      calculateFloatingPosition(triggerRef.current, placementRef.current, optionsRef.current),
    );
  }, [triggerRef]);

  /**
   * Opens beside a supplied viewport rectangle instead of the trigger's rectangle.
   * @param rect - Anchor bounds in CSS pixels, such as getBoundingClientRect() returns.
   * @example A calendar item clipped to its viewport can anchor a popup to its visible rectangle.
   */
  const openAtRect = useCallback((rect: DOMRect) => {
    anchorRectRef.current = rect;
    anchorPointRef.current = null;
    setPosition(calculateFloatingPositionFromRect(rect, placementRef.current, optionsRef.current));
  }, []);

  /**
   * Opens beside a viewport point, applying the current placement and offset.
   * @param x - Horizontal distance from the viewport's left edge in CSS pixels.
   * @param y - Vertical distance from the viewport's top edge in CSS pixels.
   * @example openAtPoint(event.clientX, event.clientY) anchors a context menu at the pointer.
   */
  const openAtPoint = useCallback((x: number, y: number) => {
    anchorRectRef.current = null;
    anchorPointRef.current = { x, y };
    setPosition(calculateFloatingPositionFromPoint(x, y, placementRef.current, optionsRef.current));
  }, []);

  /**
   * Closes an open popup or opens a closed popup beside the trigger.
   * @example Clicking the same filter button twice opens then closes its popup.
   */
  const toggle = useCallback(() => {
    if (isOpenRef.current) close();
    else open();
  }, [close, open]);

  /**
   * Adjusts an open popup to its measured size and anchor without reopening a closed popup.
   * @example A menu growing after options load is shifted to remain within the viewport.
   */
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
      measuredPosition = calculateFloatingPositionFromRect(
        anchorRectRef.current,
        placementRef.current,
        measuredOptions,
      );
    } else if (anchorPointRef.current) {
      measuredPosition = calculateFloatingPositionFromPoint(
        anchorPointRef.current.x,
        anchorPointRef.current.y,
        placementRef.current,
        measuredOptions,
      );
    } else {
      measuredPosition = calculateFloatingPosition(trigger, placementRef.current, measuredOptions);
    }

    setPosition(current => {
      // A queued resize observation must not reopen a menu after dismissal.
      if (!current) return current;

      return current.top === measuredPosition.top && current.left === measuredPosition.left
        ? current
        : measuredPosition;
    });
  }, [triggerRef]);

  // Dismiss pointer interactions outside. Viewport dismissal is shared by floating UI consumers.
  useEffect(() => {
    if (!isOpen) return;

    /**
     * Closes for pointer presses outside the trigger, this menu, and any floating panel.
     * @param event - Document pointer press whose target is checked for containment.
     * @example Clicking a nested popup leaves its parent open; clicking the page dismisses it.
     */
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
