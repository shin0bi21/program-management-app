import { isDateRange, localDateFromKey, type DateRange } from '../../../../utils/dateRange';
import { buildDayPeriod, addDays } from '../../utils/periods';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CalendarPeriod, PeriodDefinition } from '../../types';
import { saveCalendarPosition } from '../../utils/calendarPosition';

interface UsePeriodVirtualizationOptions {
  // Period construction
  periodDefinition: PeriodDefinition;
  initialDate: Date;
  periodCount: number;
  dateRange?: DateRange;

  // Viewport and saved position
  initialOffset: number;
  overscan: number;
  periodWidth: number;
  coveredLeftWidth: number;
  positionStorageKey?: string;

  // Range loading callbacks
  onInitialPeriods?: (periods: readonly CalendarPeriod[]) => void;
  onPeriodsBuilt?: (periods: readonly CalendarPeriod[], direction: 'left' | 'right') => void;
  onPeriodsReset?: (periods: readonly CalendarPeriod[]) => void;
}

/**
 * Builds the period range, renders its virtual window, and restores/persists horizontal position.
 * Requires: periodDefinition produces chronological periods; an applied dateRange contains valid chronological dates.
 * Example: scrolling right exposes a new period and reports it without rendering the entire range.
 */
export function usePeriodVirtualization({
  periodDefinition,
  initialDate,
  periodCount: requestedPeriodCount,
  dateRange,

  initialOffset,
  overscan: requestedOverscan,
  periodWidth,
  coveredLeftWidth,
  positionStorageKey,

  onInitialPeriods,
  onPeriodsBuilt,
  onPeriodsReset,
}: UsePeriodVirtualizationOptions) {
  const { periodCount, overscan } = normalizePeriodVirtualizationOptions(requestedPeriodCount, requestedOverscan);
  const allPeriods = useMemo(
    () => buildCalendarPeriods(periodDefinition, initialDate, periodCount, dateRange),
    [dateRange, initialDate, periodCount, periodDefinition],
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const initialIndex = useMemo(() => {
    const index = allPeriods.findIndex(period => initialDate >= period.start && initialDate < period.end);

    if (index < 0 && dateRange) return initialDate < allPeriods[0].start ? 0 : allPeriods.length - 1;
    if (index < 0) throw new Error('Calendar anchor date is outside its virtual period range');

    return index;
  }, [allPeriods, dateRange, initialDate]);

  const initialDateIsInRange = initialDate >= allPeriods[0].start
    && initialDate < allPeriods[allPeriods.length - 1].end;
  const restoredOffset = initialDateIsInRange ? initialOffset : 0;

  const virtualizer = useVirtualizer({
    count: allPeriods.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => periodWidth,
    horizontal: true,
    overscan,
    initialOffset: initialIndex * periodWidth + restoredOffset,
    getItemKey: index => allPeriods[index].key,
  });

  const virtualItems = virtualizer.getVirtualItems().filter(item => item.index < allPeriods.length);
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

  /** Scrolls to a known date and reports the replacement buffered window. */
  const goToDate = useCallback((date: Date) => {
    const boundedDate = dateRange
      ? new Date(Math.max(allPeriods[0].start.getTime(), Math.min(date.getTime(), allPeriods[allPeriods.length - 1].start.getTime())))
      : date;
    const targetIndex = allPeriods.findIndex(period => boundedDate >= period.start && boundedDate < period.end);

    if (targetIndex < 0) throw new Error('Calendar target date is outside its virtual period range');

    virtualizer.scrollToOffset(targetIndex * periodWidth, { align: 'start' });
    saveCalendarPosition(positionStorageKey, allPeriods[targetIndex].key, 0);

    const resetStart = Math.max(0, targetIndex - overscan);
    const resetEnd = Math.min(allPeriods.length, targetIndex + overscan + 1);

    onPeriodsReset?.(allPeriods.slice(resetStart, resetEnd));
  }, [allPeriods, dateRange, onPeriodsReset, overscan, periodWidth, positionStorageKey, virtualizer]);

  const rangeKey = dateRange ? `${dateRange.start}:${dateRange.end}` : '';
  const previousRangeKey = useRef(rangeKey);
  useEffect(function resetVisibleRange() {
    if (previousRangeKey.current === rangeKey) return;

    previousRangeKey.current = rangeKey;
    didInitialize.current = false;
    previousRange.current = null;
    virtualizer.scrollToOffset(initialIndex * periodWidth, { align: 'start' });
  }, [rangeKey, initialIndex, periodWidth, virtualizer]);

  useEffect(function publishVisiblePeriods() {
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

  useEffect(function observeCalendarPosition() {
    const viewport = viewportRef.current;

    if (!viewport || !positionStorageKey) return;

    const observedViewport = viewport;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let lastScrollLeft = observedViewport.scrollLeft;

    /** Persists the first visible period and the offset within it. */
    function savePosition(): void {
      const periodIndex = Math.min(
        allPeriods.length - 1,
        Math.max(0, Math.floor(observedViewport.scrollLeft / periodWidth)),
      );
      const period = allPeriods[periodIndex];

      if (!period) return;

      saveCalendarPosition(positionStorageKey, period.key, observedViewport.scrollLeft - periodIndex * periodWidth);
    }

    /** Debounces horizontal changes while ignoring vertical-only scrolling. */
    function schedulePositionSave(): void {
      if (observedViewport.scrollLeft === lastScrollLeft) return;

      lastScrollLeft = observedViewport.scrollLeft;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(savePosition, 100);
    }

    observedViewport.addEventListener('scroll', schedulePositionSave, { passive: true });

    return function stopObservingCalendarPosition() {
      if (saveTimer) clearTimeout(saveTimer);
      observedViewport.removeEventListener('scroll', schedulePositionSave);
    };
  }, [allPeriods, periodWidth, positionStorageKey]);

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

/** Produces integral counts with at least one period and nonnegative overscan; e.g. (3.8, -2) becomes (3, 0). */
export function normalizePeriodVirtualizationOptions(periodCount: number, overscan: number) {
  return {
    periodCount: Math.max(1, Math.floor(periodCount) || 1),
    overscan: Math.max(0, Math.floor(overscan) || 0),
  };
}

/**
 * Builds daily periods for an applied range or uses the configured initial window.
 * Throws when an applied range contains invalid or reversed dates.
 * Example: Feb 28–Mar 1 in a leap year produces three daily periods.
 */
function buildCalendarPeriods(
  periodDefinition: PeriodDefinition,
  initialDate: Date,
  periodCount: number,
  dateRange?: DateRange,
): CalendarPeriod[] {
  if (!dateRange) return periodDefinition.buildInitial(initialDate, periodCount);
  if (!isDateRange(dateRange)) throw new Error('Calendar date range must contain valid ordered dates');

  const first = localDateFromKey(dateRange.start);
  const startTime = Date.parse(`${dateRange.start}T00:00:00Z`);
  const endTime = Date.parse(`${dateRange.end}T00:00:00Z`);
  const dayCount = (endTime - startTime) / 86_400_000 + 1;

  return Array.from({ length: dayCount }, (_, index) => buildDayPeriod(addDays(first, index)));
}
