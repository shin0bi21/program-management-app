import { useCallback, useMemo, useRef, useState } from 'react';

export type CalendarInteractionType = 'item-drag' | 'range-move' | 'range-resize';

export interface CalendarInteractionCoordinator {
  claim: (type: CalendarInteractionType, pointerId: number) => boolean;
  release: (type: CalendarInteractionType, pointerId: number) => void;
}

export function useCalendarInteractionCoordinator() {
  const activeRef = useRef<{ type: CalendarInteractionType; pointerId: number } | null>(null);
  const [activeType, setActiveType] = useState<CalendarInteractionType | null>(null);
  const claim = useCallback((type: CalendarInteractionType, pointerId: number) => {
    if (activeRef.current) return false;
    activeRef.current = { type, pointerId };
    setActiveType(type);
    return true;
  }, []);
  const release = useCallback((type: CalendarInteractionType, pointerId: number) => {
    const active = activeRef.current;
    if (active?.type !== type || active.pointerId !== pointerId) return;
    activeRef.current = null;
    setActiveType(null);
  }, []);
  const coordinator = useMemo(() => ({ claim, release }), [claim, release]);
  return { coordinator, activeType };
}
