import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CalendarPeriod, PeriodDefinition } from '../../types';
import { saveCalendarPosition } from '../../utils/calendarPosition';

interface UseVirtualizedPeriodWindowOptions {
  periodDefinition: PeriodDefinition;
  initialDate: Date;
  initialOffset: number;
  periodCount: number;
  overscan: number;
  periodWidth: number;
  coveredLeftWidth: number;
  positionStorageKey?: string;
  onPeriodsBuilt?: (periods: readonly CalendarPeriod[], direction: 'left' | 'right') => void;
  onInitialPeriods?: (periods: readonly CalendarPeriod[]) => void;
  onPeriodsReset?: (periods: readonly CalendarPeriod[]) => void;
}

export function normalizePeriodVirtualizationOptions(periodCount: number, overscan: number) {
  return {
    periodCount: Math.max(1, Math.floor(periodCount) || 1),
    overscan: Math.max(0, Math.floor(overscan) || 0),
  };
}

export function usePeriodVirtualization({
  periodDefinition,
  initialDate,
  initialOffset,
  periodCount: requestedPeriodCount,
  overscan: requestedOverscan,
  periodWidth,
  coveredLeftWidth,
  positionStorageKey,
  onPeriodsBuilt,
  onInitialPeriods,
  onPeriodsReset,
}: UseVirtualizedPeriodWindowOptions) {
  const { periodCount, overscan } = normalizePeriodVirtualizationOptions(requestedPeriodCount, requestedOverscan);
  const allPeriods = useMemo(
    () => periodDefinition.buildInitial(initialDate, periodCount),
    [initialDate, periodCount, periodDefinition],
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const initialIndex = useMemo(() => {
    const index = allPeriods.findIndex(period => initialDate >= period.start && initialDate < period.end);

    if (index < 0) throw new Error('Calendar anchor date is outside its virtual period range');

    return index;
  }, [allPeriods, initialDate]);

  const virtualizer = useVirtualizer({
    count: allPeriods.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => periodWidth,
    horizontal: true,
    overscan,
    initialOffset: initialIndex * periodWidth + initialOffset,
    getItemKey: index => allPeriods[index].key,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const scrollOffset = virtualizer.scrollOffset ?? initialIndex * periodWidth;
  const visibleViewportWidth = Math.max(
    0,
    (virtualizer.scrollRect?.width ?? 0) - coveredLeftWidth,
  );
  // Center the uncovered timeline area rather than the sticky row-header region.
  const visibleCenter = scrollOffset + coveredLeftWidth + visibleViewportWidth / 2;
  const visiblePeriodIndex = Math.min(
    allPeriods.length - 1,
    Math.max(0, Math.floor(visibleCenter / periodWidth)),
  );
  const visibleYear = allPeriods[visiblePeriodIndex].start.getFullYear();

  const firstVirtualIndex = virtualItems[0]?.index ?? initialIndex;
  const lastVirtualIndex = virtualItems[virtualItems.length - 1]?.index ?? initialIndex;
  const periods = useMemo(
    () => allPeriods.slice(firstVirtualIndex, lastVirtualIndex + 1),
    [allPeriods, firstVirtualIndex, lastVirtualIndex],
  );

  const leadingPeriodWidth = virtualItems[0]?.start ?? initialIndex * periodWidth;
  const trailingPeriodWidth = virtualItems.length
    ? Math.max(0, virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end)
    : Math.max(0, virtualizer.getTotalSize() - leadingPeriodWidth);

  const didInitialize = useRef(false);
  const previousRange = useRef<{ first: number; last: number } | null>(null);

  useEffect(() => {
    if (!virtualItems.length) return;

    const first = virtualItems[0].index;
    const last = virtualItems[virtualItems.length - 1].index;
    const previous = previousRange.current;

    previousRange.current = { first, last };

    if (!didInitialize.current) {
      didInitialize.current = true;
      onInitialPeriods?.(periods);
      return;
    }

    if (!previous) return;

    if (first < previous.first) onPeriodsBuilt?.([allPeriods[first]], 'left');
    if (last > previous.last) onPeriodsBuilt?.([allPeriods[last]], 'right');
  }, [allPeriods, onInitialPeriods, onPeriodsBuilt, periods, virtualItems]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport || !positionStorageKey) return;

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let lastScrollLeft = viewport.scrollLeft;

    const savePosition = () => {
      const periodIndex = Math.min(
        allPeriods.length - 1,
        Math.max(0, Math.floor(viewport.scrollLeft / periodWidth)),
      );
      const period = allPeriods[periodIndex];

      if (!period) return;

      saveCalendarPosition(positionStorageKey, period.key, viewport.scrollLeft - periodIndex * periodWidth);
    };

    const onScroll = () => {
      if (viewport.scrollLeft === lastScrollLeft) return;

      lastScrollLeft = viewport.scrollLeft;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(savePosition, 100);
    };

    viewport.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      viewport.removeEventListener('scroll', onScroll);
    };
  }, [allPeriods, periodWidth, positionStorageKey]);

  const goToDate = useCallback((date: Date) => {
    const targetIndex = allPeriods.findIndex(period => date >= period.start && date < period.end);

    if (targetIndex < 0) throw new Error('Calendar target date is outside its virtual period range');

    virtualizer.scrollToOffset(targetIndex * periodWidth, { align: 'start' });
    saveCalendarPosition(positionStorageKey, allPeriods[targetIndex].key, 0);

    const resetStart = Math.max(0, targetIndex - overscan);
    const resetEnd = Math.min(allPeriods.length, targetIndex + overscan + 1);

    onPeriodsReset?.(allPeriods.slice(resetStart, resetEnd));
  }, [allPeriods, onPeriodsReset, overscan, periodWidth, positionStorageKey, virtualizer]);

  return {
    periods,
    allPeriods,
    viewportRef,
    goToDate,
    visibleYear,
    leadingPeriodWidth,
    trailingPeriodWidth,
  };
}
