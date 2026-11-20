import type { DateRange } from '../../../../../../common/utils/dateRange';
import { apiClient, type RequestOptions } from '../../../../../../http/client';
import type { Task, TasksFilters } from '../../../types';
import { applyTaskFilters } from '../../../api/tasks.api';

interface TaskPlacementInput {
  startDate: string;
  dueDate: string;
  staffId?: string;
}

/**
 * Loads complete tasks intersecting an inclusive calendar range and applied filters.
 * @param filters - Applied page controls shared with the table.
 * @param range - Inclusive YYYY-MM-DD viewport bounds; the backend intersects selected cycles.
 * @param opts - Request cancellation options supplied by the calendar buffer.
 * @example getTasksCalendarData(filters, { start: '2026-08-10', end: '2026-08-12' }, { signal })
 */
export function getTasksCalendarData(
  filters: TasksFilters,
  range: DateRange,
  opts?: RequestOptions,
): Promise<Task[]> {
  const params = new URLSearchParams({ ...range });
  applyTaskFilters(params, filters);

  return apiClient.get<Task[]>(`/tasks/calendar?${params}`, opts);
}

/**
 * Changes task dates or assignee and returns the complete saved task.
 * @param id - Task to move or resize.
 * @param input - Inclusive YYYY-MM-DD dates and optional replacement staff ID.
 * @example updateTaskPlacement('task-1', { startDate: '2026-08-10', dueDate: '2026-08-12' })
 */
export function updateTaskPlacement(id: string, input: TaskPlacementInput): Promise<Task> {
  return apiClient.patch<Task>(`/tasks/${id}/placement`, input);
}
