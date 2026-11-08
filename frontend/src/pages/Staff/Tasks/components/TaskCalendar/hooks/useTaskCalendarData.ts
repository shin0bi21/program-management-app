import { useCallback, useEffect, useMemo, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDataBuffer } from '../../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer';
import type { PeriodRange } from '../../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer';
import type { CalendarItemReference, RowItemData } from '../../../../../../common/components/TimelineCalendar/types';
import { getTasksCalendarData, type TasksFilters } from '../../../tasks.api';
import { taskData } from '../../../hooks/data/useTaskData';
import type { Task, TaskCalendarCache } from '../../../types';

/**
 * Loads task ranges into main data while retaining only calendar membership and placement.
 * Registers mutation callbacks for the mounted view and removes them on teardown.
 * @param records - Current saved tasks supplied by the page.
 * @param filters - Applied page filters for range requests.
 * @param calendarCacheRef - Page actions' link to this calendar's membership index.
 * @example const { calendar, visibleItems } = useTaskCalendarData(records, filters, calendarCacheRef)
 */
export default function useTaskCalendarData(
  records: Readonly<Record<string, Task>>,
  filters: TasksFilters,
  calendarCacheRef: MutableRefObject<TaskCalendarCache>,
) {
  const client = useQueryClient();

  const loadRange = useCallback(async ({ start, end }: PeriodRange, signal: AbortSignal) => {
    const read = taskData.beginRead(client);
    const incoming = await getTasksCalendarData(filters, { start: start.key, end: end.key }, { signal });
    const tasks = taskData.finishRead(client, read, incoming, signal);
    const data: Record<string, Record<string, CalendarItemReference[]>> = {};

    for (const task of tasks) {
      const resourceId = task.staffId;
      data[resourceId] ??= {};
      data[resourceId][start.key] ??= [];
      data[resourceId][start.key].push({ id: task.id, ...getTaskRange(task) });
    }

    return data;
  }, [client, filters]);

  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: getTaskId,
    getItemRange: getReferenceRange,
    errorMessage: 'Unable to load task calendar data',
  });
  const visibleItems = useMemo<RowItemData<Task>>(() => {
    const items: Record<string, Task[]> = {};
    for (const references of Object.values(calendar.items)) {
      for (const { id } of references ?? []) {
        const task = records[id];
        if (task) (items[task.staffId] ??= []).push(task);
      }
    }
    return items;
  }, [calendar.items, records]);
  const { upsertItem, removeItem } = calendar;

  useEffect(() => {
    calendarCacheRef.current = {
      upsert: task => upsertItem(task.staffId, task.startDate, { id: task.id, ...getTaskRange(task) }),
      remove: removeItem,
    };

    return () => {
      calendarCacheRef.current = {
        upsert: () => undefined,
        remove: () => undefined,
      };
    };
  }, [calendarCacheRef, removeItem, upsertItem]);

  return { calendar, visibleItems };
}

/** Identifies a task membership. @example getTaskId({ id: 'task-1' }) // 'task-1' */
const getTaskId = (task: { id: string }) => task.id;
/** Reads a buffered task interval. @example getReferenceRange(reference) // { start: reference.start, end: reference.end } */
const getReferenceRange = (reference: CalendarItemReference) => ({ start: reference.start, end: reference.end });
/** Uses a task's inclusive assignment dates. @example getTaskRange(task) // { start: task.startDate, end: task.dueDate } */
const getTaskRange = (task: Task) => ({ start: task.startDate, end: task.dueDate });
