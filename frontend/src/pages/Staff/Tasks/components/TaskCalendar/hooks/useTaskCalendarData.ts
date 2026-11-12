import { useCallback, useEffect, type MutableRefObject } from 'react';
import { useDataBuffer } from '../../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer';
import type { PeriodRange } from '../../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer';
import { getTasksCalendarData, type TasksFilters } from '../../../tasks.api';
import type { Task, TaskCalendarCache } from '../../../types';

/**
 * Loads complete task rows into the calendar range buffer.
 * Registers mutation callbacks for the mounted view and removes them on teardown.
 * @param filters - Applied page filters for range requests.
 * @param calendarCacheRef - Page actions' link to this calendar's membership index.
 * @example const { calendar, visibleItems } = useTaskCalendarData(filters, calendarCacheRef)
 */
export default function useTaskCalendarData(
  filters: TasksFilters,
  calendarCacheRef: MutableRefObject<TaskCalendarCache>,
) {
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
      calendarCacheRef.current = {
        upsert: () => undefined,
        remove: () => undefined,
      };
    };
  }, [calendarCacheRef, removeItem, upsertItem]);

  return { calendar, visibleItems: calendar.items };
}

/** Identifies a task membership. @example getTaskId({ id: 'task-1' }) // 'task-1' */
function getTaskId(task: { id: string }) {
  return task.id;
}
/** Uses a task's inclusive assignment dates. @example getTaskRange(task) // { start: task.startDate, end: task.dueDate } */
function getTaskRange(task: Task) {
  return { start: task.startDate, end: task.dueDate };
}
