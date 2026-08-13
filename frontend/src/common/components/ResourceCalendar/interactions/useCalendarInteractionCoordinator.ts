import { useCallback, useMemo, useRef } from 'react';

export type CalendarInteractionType = 'item-drag' | 'range-move' | 'range-resize';

export interface CalendarInteractionCoordinator {
  claim: (type: CalendarInteractionType, pointerId: number) => boolean;
  release: (type: CalendarInteractionType, pointerId: number) => void;
}

export function useCalendarInteractionCoordinator(): CalendarInteractionCoordinator {
  const activeRef = useRef<{ type: CalendarInteractionType; pointerId: number } | null>(null);
  const claim = useCallback((type: CalendarInteractionType, pointerId: number) => {
    if (activeRef.current) return false;
    activeRef.current = { type, pointerId };
    return true;
  }, []);
  const release = useCallback((type: CalendarInteractionType, pointerId: number) => {
    const active = activeRef.current;
    if (active?.type === type && active.pointerId === pointerId) activeRef.current = null;
  }, []);
  return useMemo(() => ({ claim, release }), [claim, release]);
}
