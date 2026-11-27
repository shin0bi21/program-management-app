import { useCallback, useEffect, type MutableRefObject } from 'react';
import { useDataBuffer } from '../../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer';
import type { PeriodRange } from '../../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer';
import { getTasksCalendarData } from '../api/taskCalendar.api';
import { getTaskId, getTaskRange } from '../taskCalendarRecords';
import type { Task, TaskCalendarCache, TasksFilters } from '../../../types';

type TaskCalendarBuffer = ReturnType<typeof useDataBuffer<Task>>;

/**
 * Loads complete task rows into the calendar range buffer.
 * Registers mutation callbacks for the mounted view and removes them on teardown.
 * @param filters - Applied page filters for range requests.
 * @param calendarCacheRef - Page-owned ref populated while this calendar is mounted.
 * @example const calendar = useTaskCalendarData(filters, calendarCacheRef)
 */
export default function useTaskCalendarData(
  filters: TasksFilters,
  calendarCacheRef: MutableRefObject<TaskCalendarCache | null>,
): TaskCalendarBuffer {
  const loadRange = useCallback(async ({ start, end }: PeriodRange, signal: AbortSignal) => {
    const tasks = await getTasksCalendarData(filters, { start: start.key, end: end.key }, { signal });
    signal.throwIfAborted();
    const data: Record<string, Record<string, Task[]>> = {};

    for (const task of tasks) {
      const staffId = task.staffId;
      data[staffId] ??= {};
      data[staffId][start.key] ??= [];
      data[staffId][start.key].push(task);
    }

    return data;
  }, [filters]);

  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: getTaskId,
    getItemRange: getTaskRange,
    errorMessage: 'Unable to load task calendar data',
  });
  const { upsertItem, removeItem } = calendar;

  useEffect(() => {
    calendarCacheRef.current = {
      upsert: task => upsertItem(task.staffId, task.startDate, task),
      remove: removeItem,
    };

    return () => {
      calendarCacheRef.current = null;
    };
  }, [calendarCacheRef, removeItem, upsertItem]);

  return calendar;
}
