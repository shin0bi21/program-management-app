import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CalendarPeriod, PeriodDefinition } from '../types';

type Direction = 'left' | 'right';

interface UsePeriodWindowOptions {
  periodDefinition: PeriodDefinition;
  initialDate: Date;
  initialPeriodCount: number;
  periodBuildSize: number;
  periodWidth: number;
  coveredLeftWidth: number;
  onPeriodsBuilt?: (periods: readonly CalendarPeriod[], direction: Direction) => void;
  onInitialPeriods?: (periods: readonly CalendarPeriod[]) => void;
  initialLeadingPeriodCount: number;
  ready: boolean;
  onPeriodsReset?: (periods: readonly CalendarPeriod[]) => void;
}

export function normalizePeriodWindowOptions(initialPeriodCount: number, periodBuildSize: number) {
  const windowSize = Math.max(2, Math.floor(initialPeriodCount) || 2);
  const buildSize = Math.min(windowSize - 1, Math.max(1, Math.floor(periodBuildSize) || 1));
  return { windowSize, buildSize };
}

export function usePeriodWindow({
  periodDefinition,
  initialDate,
  initialPeriodCount,
  periodBuildSize,
  periodWidth,
  coveredLeftWidth,
  onPeriodsBuilt,
  onInitialPeriods,
  initialLeadingPeriodCount,
  ready,
  onPeriodsReset,
}: UsePeriodWindowOptions) {
  const { windowSize, buildSize } = normalizePeriodWindowOptions(initialPeriodCount, periodBuildSize);
  const [periods, setPeriods] = useState<CalendarPeriod[]>(() => (
    periodDefinition.buildInitial(initialDate, windowSize)
  ));
  const viewportRef = useRef<HTMLDivElement>(null);
  const periodsRef = useRef(periods);
  const queues = useRef<Record<Direction, Promise<void>>>({
    left: Promise.resolve(),
    right: Promise.resolve(),
  });
  const pendingScrollAdjustment = useRef(0);
  const pendingBuiltEvents = useRef<Array<{ periods: readonly CalendarPeriod[]; direction: Direction }>>([]);
  const pendingSuppressedEdges = useRef(new Set<Direction>());
  const didSetInitialPosition = useRef(false);
  const didNotifyInitialPeriods = useRef(false);
  const previousWindowSize = useRef(windowSize);
  const pendingReset = useRef(false);

  useLayoutEffect(() => {
    if (previousWindowSize.current === windowSize) return;
    previousWindowSize.current = windowSize;
    const resized = periodDefinition.buildInitial(initialDate, windowSize);
    periodsRef.current = resized;
    didSetInitialPosition.current = false;
    setPeriods(resized);
  }, [initialDate, periodDefinition, windowSize]);

  const enqueueEdge = useCallback((direction: Direction) => {
    queues.current[direction] = queues.current[direction].then(() => {
      const shifted = periodDefinition.shiftWindow(periodsRef.current, direction, buildSize, windowSize);
      if (!shifted.built.length) return;

      pendingScrollAdjustment.current += direction === 'left'
        ? shifted.built.length * periodWidth
        : -shifted.built.length * periodWidth;
      pendingBuiltEvents.current.push({ periods: shifted.built, direction });
      pendingSuppressedEdges.current.add(direction === 'left' ? 'right' : 'left');
      periodsRef.current = shifted.periods;
      setPeriods(shifted.periods);
    });
  }, [buildSize, periodDefinition, periodWidth, windowSize]);

  const observeEdge = useCallback((element: HTMLElement, direction: Direction) => {
    if (element.classList.contains('resource-calendar__period--observed')
      && element.dataset.observedEdge === direction) return;
    element.classList.add('resource-calendar__period--observed');
    element.dataset.observedEdge = direction;
    enqueueEdge(direction);
  }, [enqueueEdge]);

  const goToDate = useCallback((date: Date) => {
    const resetPeriods = periodDefinition.buildInitial(date, windowSize);
    periodsRef.current = resetPeriods;
    pendingScrollAdjustment.current = 0;
    pendingBuiltEvents.current = [];
    pendingSuppressedEdges.current.clear();
    didSetInitialPosition.current = false;
    pendingReset.current = true;
    setPeriods(resetPeriods);
  }, [periodDefinition, windowSize]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!ready || !viewport || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const element = entry.target as HTMLElement;
        const direction = element.dataset.edge;
        if (direction !== 'left' && direction !== 'right') return;

        if (!entry.isIntersecting) {
          if (element.dataset.observedEdge === direction) {
            element.classList.remove('resource-calendar__period--observed');
            delete element.dataset.observedEdge;
          }
          return;
        }
        observeEdge(element, direction);
      });
    }, {
      root: viewport,
      rootMargin: `0px 0px 0px -${coveredLeftWidth}px`,
      threshold: 0.05,
    });

    viewport.querySelectorAll<HTMLElement>('.resource-calendar__period').forEach(period => {
      const currentEdge = period.dataset.edge;
      if (!currentEdge || (period.dataset.observedEdge && period.dataset.observedEdge !== currentEdge)) {
        period.classList.remove('resource-calendar__period--observed');
        delete period.dataset.observedEdge;
      }
    });
    viewport.querySelectorAll<HTMLElement>('[data-edge]').forEach(edge => observer.observe(edge));
    return () => observer.disconnect();
  }, [coveredLeftWidth, observeEdge, periods, ready]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!ready || !viewport || periods.length !== windowSize) return;

    if (!didSetInitialPosition.current) {
      viewport.scrollLeft = Math.max(0, initialLeadingPeriodCount * periodWidth);
      didSetInitialPosition.current = true;
      if (!didNotifyInitialPeriods.current) {
        didNotifyInitialPeriods.current = true;
        onInitialPeriods?.(periods);
      }
      if (pendingReset.current) {
        pendingReset.current = false;
        onPeriodsReset?.(periods);
      }
    }
    if (pendingScrollAdjustment.current) {
      viewport.scrollLeft += pendingScrollAdjustment.current;
      pendingScrollAdjustment.current = 0;
    }
    pendingSuppressedEdges.current.forEach(direction => {
      const edge = viewport.querySelector<HTMLElement>(`[data-edge="${direction}"]`);
      if (!edge) return;
      edge.classList.add('resource-calendar__period--observed');
      edge.dataset.observedEdge = direction;
    });
    pendingSuppressedEdges.current.clear();
    pendingBuiltEvents.current.splice(0).forEach(event => onPeriodsBuilt?.(event.periods, event.direction));
  }, [initialLeadingPeriodCount, onInitialPeriods, onPeriodsBuilt, onPeriodsReset, periodWidth, periods, ready, windowSize]);

  return { periods, viewportRef, goToDate };
}
