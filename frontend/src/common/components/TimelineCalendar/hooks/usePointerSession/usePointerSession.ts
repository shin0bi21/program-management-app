import { useCallback, useEffect, useRef, useState } from 'react';

const POINTER_THRESHOLD = 10;

export type PointerSessionType = 'item-move' | 'item-resize';
export type PointerSessionCancelReason =
  | 'document-hidden'
  | 'pointer-cancel'
  | 'replaced-after-capture-loss'
  | 'unmount'
  | 'window-blur';

interface PointerSessionOptions {
  // Pointer identity and capture
  type: PointerSessionType;
  pointerId: number;
  captureElement: HTMLElement;

  // Activation threshold
  startX: number;
  startY: number;
  axis?: 'both' | 'horizontal';

  // Interaction lifecycle
  onActivate: (event: PointerEvent) => void;
  onMove: (event: PointerEvent) => void;
  onEnd: (event: PointerEvent) => void;
  onCancel: (reason: PointerSessionCancelReason) => void;
  onFrame?: () => void;
}

interface ActivePointerSession extends PointerSessionOptions {
  active: boolean;
  captureLost: boolean;
}

export type StartPointerSession = (options: PointerSessionOptions) => boolean;

/**
 * Coordinates one pointer interaction and one native-listener set for this calendar.
 * Requires: the calendar keeps this hook mounted while virtualized item callbacks are retained.
 * Example: a second drag is rejected while the active interaction retains pointer capture.
 */
export function usePointerSession() {
  const sessionRef = useRef<ActivePointerSession | null>(null);
  const animationFrameRef = useRef<number>();
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number>();

  const [activeType, setActiveType] = useState<PointerSessionType | null>(null);

  /** Consumes the synthetic click following a drag/resize until the current event task finishes. */
  const suppressNextClick = useCallback(() => {
    suppressClickRef.current = true;
    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  }, []);
  const isClickSuppressed = useCallback(() => suppressClickRef.current, []);

  /** Stops the shared animation loop after completion, cancellation, or capture loss. */
  const stopPointerSessionFrames = useCallback(() => {
    if (animationFrameRef.current === undefined) return;

    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = undefined;
  }, []);

  /** Delivers one active-session frame and schedules the next while the session remains retained. */
  const runPointerSessionFrame = useCallback(function runPointerSessionFrame() {
    const session = sessionRef.current;

    if (!session) {
      animationFrameRef.current = undefined;
      return;
    }

    session.onFrame?.();
    animationFrameRef.current = requestAnimationFrame(runPointerSessionFrame);
  }, []);

  /** Releases shared resources and reports cancellation, optionally avoiding state updates on unmount. */
  const cancelPointerSession = useCallback((
    session: ActivePointerSession,
    reason: PointerSessionCancelReason,
    updateActiveType = true,
  ) => {
    if (sessionRef.current === session) sessionRef.current = null;

    stopPointerSessionFrames();
    if (updateActiveType) setActiveType(null);

    releasePointer(session.captureElement, session.pointerId);
    session.onCancel(reason);
  }, [stopPointerSessionFrames]);

  /** Claims the coordinator for one pending pointer interaction without activating it prematurely. */
  const startPointerSession = useCallback<StartPointerSession>((options) => {
    let current = sessionRef.current;

    if (current?.captureLost) {
      cancelPointerSession(current, 'replaced-after-capture-loss');
      current = null;
    }

    if (current) return false;

    sessionRef.current = {
      ...options,
      axis: options.axis ?? 'both',
      active: false,
      captureLost: false,
    };

    setActiveType(options.type);
    animationFrameRef.current = requestAnimationFrame(runPointerSessionFrame);

    return true;
  }, [cancelPointerSession, runPointerSessionFrame]);

  // Stable coordinator callbacks keep ordinary renders from reinstalling native listeners.
  useEffect(function observePointerSession() {
    /** Activates after the threshold, recovers transient capture loss, and delivers pointer movement. */
    function updatePointerSession(event: PointerEvent): void {
      const session = sessionRef.current;

      if (!session || event.pointerId !== session.pointerId) return;
      // A mouse move with no pressed button is a late release, not a recapture opportunity.
      if (isReleasedMousePointer(event)) return;
      if (!session.active && !hasCrossedPointerThreshold(session, event)) return;

      event.preventDefault();

      if (!session.active) {
        session.active = true;
        session.captureLost = !tryCapturePointer(session.captureElement, event.pointerId);

        if (session.captureLost) stopPointerSessionFrames();
        session.onActivate(event);
      } else if (session.captureLost) {
        session.captureLost = !tryCapturePointer(session.captureElement, event.pointerId);

        if (!session.captureLost) {
          if (animationFrameRef.current === undefined) {
            animationFrameRef.current = requestAnimationFrame(runPointerSessionFrame);
          }
        }
      }

      session.onMove(event);
    }

    /** Finishes the matching interaction and releases capture before reporting its result. */
    function endPointerSession(event: PointerEvent): void {
      const session = sessionRef.current;

      if (!session || event.pointerId !== session.pointerId) return;

      sessionRef.current = null;
      stopPointerSessionFrames();
      setActiveType(null);

      releasePointer(session.captureElement, event.pointerId);
      session.onEnd(event);
    }

    /** Cancels only the interaction matching the browser-cancelled pointer. */
    function handlePointerCancel(event: PointerEvent): void {
      const session = sessionRef.current;

      if (!session || event.pointerId !== session.pointerId) return;

      cancelPointerSession(session, 'pointer-cancel');
    }

    /** Pauses frames after transient capture loss so a later move can try to recapture. */
    function handlePointerCaptureLoss(event: PointerEvent): void {
      const pointerId = event.pointerId;
      const capturedSession = sessionRef.current;

      if (!capturedSession || capturedSession.pointerId !== pointerId) return;
      if (event.target !== capturedSession.captureElement) return;

      // Capture loss can be transient; retain the session so the next move can recapture it.
      capturedSession.captureLost = true;
      stopPointerSessionFrames();
    }

    /** Cancels the active interaction when the browser loses focus. */
    function handleWindowBlur(): void {
      const session = sessionRef.current;

      if (session) cancelPointerSession(session, 'window-blur');
    }

    /** Cancels the active interaction when the document becomes hidden. */
    function handleDocumentVisibilityChange(): void {
      const session = sessionRef.current;

      if (session && document.visibilityState === 'hidden') {
        cancelPointerSession(session, 'document-hidden');
      }
    }

    window.addEventListener('pointermove', updatePointerSession, { passive: false });
    window.addEventListener('pointerup', endPointerSession, true);
    window.addEventListener('pointercancel', handlePointerCancel, true);
    window.addEventListener('lostpointercapture', handlePointerCaptureLoss);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleDocumentVisibilityChange);

    return function stopObservingPointerSession() {
      window.removeEventListener('pointermove', updatePointerSession);
      window.removeEventListener('pointerup', endPointerSession, true);
      window.removeEventListener('pointercancel', handlePointerCancel, true);
      window.removeEventListener('lostpointercapture', handlePointerCaptureLoss);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleDocumentVisibilityChange);
      window.clearTimeout(suppressClickTimerRef.current);

      const session = sessionRef.current;

      if (!session) return;

      cancelPointerSession(session, 'unmount', false);
    };
  }, [cancelPointerSession, runPointerSessionFrame, stopPointerSessionFrames]);

  return { activeType, startPointerSession, suppressNextClick, isClickSuppressed };
}

/** Tests whether pointer movement has reached the interaction's activation threshold. */
function hasCrossedPointerThreshold(session: ActivePointerSession, event: PointerEvent) {
  return session.axis === 'horizontal'
    ? Math.abs(event.clientX - session.startX) >= POINTER_THRESHOLD
    : Math.hypot(event.clientX - session.startX, event.clientY - session.startY) >= POINTER_THRESHOLD;
}

/** Identifies a late mouse move after release, which must not reacquire capture. */
function isReleasedMousePointer(event: PointerEvent) {
  return event.pointerType === 'mouse' && event.buttons === 0;
}

/** Attempts pointer capture and reports failure when the browser rejects it. */
function tryCapturePointer(element: HTMLElement, pointerId: number) {
  try {
    element.setPointerCapture?.(pointerId);
    return element.hasPointerCapture?.(pointerId) ?? true;
  } catch {
    return false;
  }
}

/** Releases pointer capture safely when the browser may already have released it. */
function releasePointer(element: HTMLElement, pointerId: number) {
  try {
    if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // The browser may have already released this pointer.
  }
}
