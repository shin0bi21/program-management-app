import { apiClient, type RequestOptions } from '../../../../../../http/client';
import type { CursorPage, CursorRequest } from '../../../../../../query/types';
import type { Task, TasksFilters } from '../../../types';
import { applyTaskFilters } from '../../../api/tasks.api';

/**
 * Loads one cursor page of complete tasks in server filter and sort order.
 * @param filters - Applied page controls shared with the calendar.
 * @param opts - Request cancellation options.
 * @param pagination - Server sort and optional continuation cursor; the server owns page size.
 * @example getTasksTableData(filters, { signal }, { key: 'dueDate', direction: 'asc' })
 */
export function getTasksTableData(
  filters: TasksFilters,
  opts: RequestOptions | undefined,
  pagination: CursorRequest,
): Promise<CursorPage<Task>> {
  const params = new URLSearchParams({
    sort: pagination.key, direction: pagination.direction,
  });
  if (pagination.cursor) params.set('cursor', pagination.cursor);
  applyTaskFilters(params, filters);

  return apiClient.get<CursorPage<Task>>(`/tasks/list?${params}`, opts);
}
