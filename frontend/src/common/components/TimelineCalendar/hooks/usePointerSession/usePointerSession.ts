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
  type: PointerSessionType;
  pointerId: number;
  startX: number;
  startY: number;
  axis?: 'both' | 'horizontal';
  captureElement: HTMLElement;
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

export type BeginPointerSession = (options: PointerSessionOptions) => boolean;

function crossedThreshold(session: ActivePointerSession, event: PointerEvent) {
  return session.axis === 'horizontal'
    ? Math.abs(event.clientX - session.startX) >= POINTER_THRESHOLD
    : Math.hypot(event.clientX - session.startX, event.clientY - session.startY) >= POINTER_THRESHOLD;
}

function isReleasedMousePointer(event: PointerEvent) {
  return event.pointerType === 'mouse' && event.buttons === 0;
}

function capturePointer(element: HTMLElement, pointerId: number) {
  try {
    element.setPointerCapture?.(pointerId);
    return element.hasPointerCapture?.(pointerId) ?? true;
  } catch {
    return false;
  }
}

function releasePointer(element: HTMLElement, pointerId: number) {
  try {
    if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // The browser may have already released this pointer.
  }
}

export function usePointerSession() {
  const sessionRef = useRef<ActivePointerSession | null>(null);
  const animationFrameRef = useRef<number>();

  const [activeType, setActiveType] = useState<PointerSessionType | null>(null);

  const stopFrames = useCallback(() => {
    if (animationFrameRef.current === undefined) return;

    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = undefined;
  }, []);

  const runFrame = useCallback(function frame() {
    const session = sessionRef.current;

    if (!session) {
      animationFrameRef.current = undefined;
      return;
    }

    session.onFrame?.();
    animationFrameRef.current = requestAnimationFrame(frame);
  }, []);

  const cancelSession = useCallback((
    session: ActivePointerSession,
    reason: PointerSessionCancelReason,
    updateActiveType = true,
  ) => {
    if (sessionRef.current === session) sessionRef.current = null;

    stopFrames();
    if (updateActiveType) setActiveType(null);

    releasePointer(session.captureElement, session.pointerId);
    session.onCancel(reason);
  }, [stopFrames]);

  const beginPointerSession = useCallback<BeginPointerSession>((options) => {
    let current = sessionRef.current;

    if (current?.captureLost) {
      cancelSession(current, 'replaced-after-capture-loss');
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
    animationFrameRef.current = requestAnimationFrame(runFrame);

    return true;
  }, [cancelSession, runFrame]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const session = sessionRef.current;

      if (!session || event.pointerId !== session.pointerId) return;
      // A mouse move with no pressed button is a late release, not a recapture opportunity.
      if (isReleasedMousePointer(event)) return;
      if (!session.active && !crossedThreshold(session, event)) return;

      event.preventDefault();

      if (!session.active) {
        session.active = true;
        session.captureLost = !capturePointer(session.captureElement, event.pointerId);

        if (session.captureLost) stopFrames();
        session.onActivate(event);
      } else if (session.captureLost) {
        session.captureLost = !capturePointer(session.captureElement, event.pointerId);

        if (!session.captureLost) {
          if (animationFrameRef.current === undefined) {
            animationFrameRef.current = requestAnimationFrame(runFrame);
          }
        }
      }

      session.onMove(event);
    };

    const end = (event: PointerEvent) => {
      const session = sessionRef.current;

      if (!session || event.pointerId !== session.pointerId) return;

      sessionRef.current = null;
      stopFrames();
      setActiveType(null);

      releasePointer(session.captureElement, event.pointerId);
      session.onEnd(event);
    };

    const pointerCancel = (event: PointerEvent) => {
      const session = sessionRef.current;

      if (!session || event.pointerId !== session.pointerId) return;

      cancelSession(session, 'pointer-cancel');
    };

    const lostCapture = (event: PointerEvent) => {
      const pointerId = event.pointerId;
      const capturedSession = sessionRef.current;

      if (!capturedSession || capturedSession.pointerId !== pointerId) return;
      if (event.target !== capturedSession.captureElement) return;

      // Capture loss can be transient; retain the session so the next move can recapture it.
      capturedSession.captureLost = true;
      stopFrames();
    };

    const windowBlur = () => {
      const session = sessionRef.current;

      if (session) cancelSession(session, 'window-blur');
    };

    const visibilityChange = () => {
      const session = sessionRef.current;

      if (session && document.visibilityState === 'hidden') {
        cancelSession(session, 'document-hidden');
      }
    };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', pointerCancel, true);
    window.addEventListener('lostpointercapture', lostCapture);
    window.addEventListener('blur', windowBlur);
    document.addEventListener('visibilitychange', visibilityChange);

    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', pointerCancel, true);
      window.removeEventListener('lostpointercapture', lostCapture);
      window.removeEventListener('blur', windowBlur);
      document.removeEventListener('visibilitychange', visibilityChange);

      const session = sessionRef.current;

      if (!session) return;

      cancelSession(session, 'unmount', false);
    };
  }, [cancelSession, runFrame, stopFrames]);

  return { activeType, beginPointerSession };
}
