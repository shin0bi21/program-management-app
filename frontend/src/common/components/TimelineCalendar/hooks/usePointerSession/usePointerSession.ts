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
 * Runs one calendar move or resize from pointer-down through activation, recovery, and cleanup.
 * Requires: this hook and the capture viewport stay mounted while retained item callbacks run;
 * the source item may unmount during virtualization.
 * Effects: installs window/document listeners and runs onFrame while an activated pointer is captured.
 * Example: start at (100, 100), move to (110, 100) => onActivate then onMove;
 * capture loss pauses frames, a held move recaptures, and pointerup cleans up before onEnd.
 * A competing start returns false unless it replaces a session whose capture was lost.
 */
export function usePointerSession() {
  const sessionRef = useRef<ActivePointerSession | null>(null);
  const animationFrameRef = useRef<number>();
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number>();

  const [activeType, setActiveType] = useState<PointerSessionType | null>(null);

  const stopFrames = useCallback(() => {
    if (animationFrameRef.current === undefined) return;

    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = undefined;
  }, []);

  const cancelSession = useCallback((
    session: ActivePointerSession,
    reason: PointerSessionCancelReason,
  ) => {
    if (sessionRef.current === session) sessionRef.current = null;

    stopFrames();
    setActiveType(null);

    releasePointer(session);
    session.onCancel(reason);
  }, [stopFrames]);

  const startPointerSession = useCallback((options: PointerSessionOptions) => {
    const current = sessionRef.current;

    if (current?.captureLost) cancelSession(current, 'replaced-after-capture-loss');
    if (sessionRef.current) return false;

    sessionRef.current = {
      ...options,
      active: false,
      captureLost: false,
    };

    return true;
  }, [cancelSession]);

  const suppressNextClick = useCallback(() => {
    suppressClickRef.current = true;
    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  }, []);

  const isClickSuppressed = useCallback(() => suppressClickRef.current, []);

  useEffect(function mount() {
    function handleMove(event: PointerEvent): void {
      const session = sessionRef.current;

      if (!session || event.pointerId !== session.pointerId) return;
      // A retained session must not recapture a mouse that has already been released.
      if (isReleasedMousePointer(event)) return;
      if (!session.active && !hasCrossedPointerThreshold(session, event)) return;

      event.preventDefault();

      if (!session.active || session.captureLost) {
        session.captureLost = !tryCapturePointer(session.captureElement, event.pointerId);
        if (!session.captureLost && animationFrameRef.current === undefined) {
          animationFrameRef.current = requestAnimationFrame(runFrame);
        }
      }

      if (!session.active) {
        session.active = true;
        setActiveType(session.type);
        session.onActivate(event);
      }

      session.onMove(event);
    }

    function runFrame() {
      const session = sessionRef.current;

      if (!session) {
        animationFrameRef.current = undefined;
        return;
      }

      session.onFrame?.();
      animationFrameRef.current = requestAnimationFrame(runFrame);
    }

    function handleCaptureLoss(event: PointerEvent): void {
      const session = sessionRef.current;

      if (session?.pointerId === event.pointerId && event.target === session.captureElement) {
        // Keep the workflow alive across transient capture loss; the next held move retries.
        session.captureLost = true;
        stopFrames();
      }
    }

    function handleEnd(event: PointerEvent): void {
      const session = sessionRef.current;

      if (!session || event.pointerId !== session.pointerId) return;

      sessionRef.current = null;
      stopFrames();
      setActiveType(null);

      releasePointer(session);
      session.onEnd(event);
    }

    function handlePointerCancel(event: PointerEvent): void {
      const session = sessionRef.current;

      if (!session || event.pointerId !== session.pointerId) return;

      cancelSession(session, 'pointer-cancel');
    }

    function handleWindowBlur(): void {
      const session = sessionRef.current;

      if (session) cancelSession(session, 'window-blur');
    }

    function handleDocumentVisibilityChange(): void {
      const session = sessionRef.current;

      if (session && document.visibilityState === 'hidden') {
        cancelSession(session, 'document-hidden');
      }
    }

    window.addEventListener('pointermove', handleMove, { passive: false });
    // Finish before target handlers can release capture and trigger recovery.
    window.addEventListener('pointerup', handleEnd, true);
    window.addEventListener('pointercancel', handlePointerCancel, true);
    window.addEventListener('lostpointercapture', handleCaptureLoss);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleDocumentVisibilityChange);

    return function unmount() {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd, true);
      window.removeEventListener('pointercancel', handlePointerCancel, true);
      window.removeEventListener('lostpointercapture', handleCaptureLoss);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleDocumentVisibilityChange);
      window.clearTimeout(suppressClickTimerRef.current);

      const session = sessionRef.current;

      if (!session) return;

      cancelSession(session, 'unmount');
    };
  }, [cancelSession, stopFrames]);

  return { activeType, startPointerSession, suppressNextClick, isClickSuppressed };
}

function isReleasedMousePointer(event: PointerEvent) {
  return event.pointerType === 'mouse' && event.buttons === 0;
}

function hasCrossedPointerThreshold(session: ActivePointerSession, event: PointerEvent) {
  return session.axis === 'horizontal'
    ? Math.abs(event.clientX - session.startX) >= POINTER_THRESHOLD
    : Math.hypot(event.clientX - session.startX, event.clientY - session.startY) >= POINTER_THRESHOLD;
}

function tryCapturePointer(element: HTMLElement, pointerId: number) {
  try {
    element.setPointerCapture(pointerId);
    return element.hasPointerCapture(pointerId);
  } catch {
    return false;
  }
}

function releasePointer(session: ActivePointerSession) {
  try {
    session.captureElement.releasePointerCapture(session.pointerId);
  } catch {
    // The browser may have already released this pointer.
  }
}
