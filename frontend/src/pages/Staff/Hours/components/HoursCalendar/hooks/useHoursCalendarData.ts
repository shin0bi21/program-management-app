import { useCallback, useEffect, type MutableRefObject } from 'react';
import { useDataBuffer } from '../../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer';
import type { PeriodRange } from '../../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer';
import { getHoursCalendarData } from '../../../hours.api';
import type { HoursCalendarIndex, HoursFilters, Hours } from '../../../types';

/** Identifies an entry in the calendar buffer. @example getHoursItemId({ id: 'hours-1' }) // 'hours-1' */
const getHoursItemId = (item: Hours) => item.id;

/**
 * Loads complete Hours rows into the calendar range buffer.
 * Registers mutation callbacks for the mounted view and removes them on teardown.
 * @param filters - Applied page filters, also used to scope mutation placement.
 * @param calendarIndexRef - Page-owned ref populated while this calendar is mounted.
 * @example const calendar = useHoursCalendarData(filters, calendarIndexRef)
 */
export default function useHoursCalendarData(
  filters: HoursFilters,
  calendarIndexRef: MutableRefObject<HoursCalendarIndex | null>,
): ReturnType<typeof useDataBuffer<Hours>> {
  const loadRange = useCallback(async ({ start, end }: PeriodRange, signal: AbortSignal) => {
    const rows = await getHoursCalendarData(filters, { start: start.key, end: end.key }, { signal });
    signal.throwIfAborted();
    const index: Record<string, Record<string, Hours[]>> = {};

    for (const entry of rows) {
      const periods = index[entry.staffId] ??= {};
      const items = periods[entry.date] ??= [];
      items.push(entry);
    }
    return index;
  }, [filters]);

  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: getHoursItemId,
    errorMessage: 'Unable to load hours data',
  });
  const { upsertItem, removeItem } = calendar;

  useEffect(() => {
    calendarIndexRef.current = {
      upsert: (entry) => {
        const outsideSelectedCycles = filters.cycleIds?.length && !filters.cycleIds.includes(entry.cycleId);

        // A move can resolve to an unselected cycle inside the displayed date span.
        if (outsideSelectedCycles) {
          removeItem(entry.id);
          return;
        }

        upsertItem(entry.staffId, entry.date, entry);
      },
      remove: removeItem,
    };

    return () => {
      calendarIndexRef.current = null;
    };
  }, [calendarIndexRef, filters.cycleIds, removeItem, upsertItem]);

  return calendar;
}
