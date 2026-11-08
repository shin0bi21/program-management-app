import { useCallback, useEffect, useMemo, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDataBuffer } from '../../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer';
import type { PeriodRange } from '../../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer';
import type { RowItemData } from '../../../../../../common/components/TimelineCalendar/types';
import type { RecordReference } from '../../../../../../query/createRecordStore';
import { getHoursCalendarData } from '../../../hours.api';
import { hoursData } from '../../../hooks/data/useHoursData';
import type { HoursCalendarIndex, HoursFilters, HoursItem } from '../../../types';

/** Identifies an entry without retaining another saved record. @example getHoursItemId({ id: 'hours-1' }) // 'hours-1' */
const getHoursItemId = (item: RecordReference) => item.id;

/**
 * Loads Hours ranges into main data while retaining only calendar membership and placement.
 * Registers mutation callbacks for the mounted view and removes them on teardown.
 * @param records - Current saved records supplied by the page.
 * @param filters - Applied page filters, also used to scope mutation placement.
 * @param calendarIndexRef - Page actions' link to this calendar's membership index.
 * @example const { calendar, visibleItems } = useHoursCalendarData(records, filters, calendarIndexRef)
 */
export default function useHoursCalendarData(
  records: Readonly<Record<string, HoursItem>>,
  filters: HoursFilters,
  calendarIndexRef: MutableRefObject<HoursCalendarIndex>,
) {
  const client = useQueryClient();

  const loadRange = useCallback(async ({ start, end }: PeriodRange, signal: AbortSignal) => {
    const read = hoursData.beginRead(client);
    const incoming = await getHoursCalendarData(filters, { start: start.key, end: end.key }, { signal });
    const rows = hoursData.finishRead(client, read, incoming, signal);
    const index: Record<string, Record<string, RecordReference[]>> = {};

    for (const entry of rows) {
      const periods = index[entry.staffId] ??= {};
      const items = periods[entry.date] ??= [];
      items.push({ id: entry.id });
    }
    return index;
  }, [client, filters]);

  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: getHoursItemId,
    errorMessage: 'Unable to load hours data',
  });
  const visibleItems = useMemo<RowItemData<HoursItem>>(() => {
    const items: Record<string, HoursItem[]> = {};
    for (const references of Object.values(calendar.items)) {
      for (const { id } of references ?? []) {
        const entry = records[id];
        if (entry) (items[entry.staffId] ??= []).push(entry);
      }
    }
    return items;
  }, [calendar.items, records]);

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

        upsertItem(entry.staffId, entry.date, { id: entry.id });
      },
      remove: removeItem,
    };

    return () => {
      calendarIndexRef.current = {
        upsert: () => undefined,
        remove: () => undefined,
      };
    };
  }, [calendarIndexRef, filters.cycleIds, removeItem, upsertItem]);

  return { calendar, visibleItems };
}
