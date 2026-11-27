import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type { Task, TaskStatus, TasksFilters } from '../types';

export type SetTaskInput = Pick<Task, 'title' | 'details' | 'category' | 'programId' | 'startDate' | 'dueDate' | 'staffId'>;

type TaskPlacementInput = Pick<Task, 'startDate' | 'dueDate'> & Partial<Pick<Task, 'staffId'>>;

/**
 * Loads accessible open tasks for a staff overview or Hours task choices.
 * @param staffId - Staff member whose open tasks are requested.
 * @param opts - Request cancellation options from the consuming query.
 * @example getOpenTasks('staff-1', { signal })
 */
export function getOpenTasks(staffId: Task['staffId'], opts?: RequestOptions): Promise<Task[]> {
  const params = new URLSearchParams();
  params.set('staffId', staffId);
  return apiClient.get<Task[]>(`/tasks?${params}`, opts);
}

export interface TaskReferenceData {
  categories: Array<{ id: Task['category']; name: string }>;
  statuses: Array<{ id: TaskStatus; name: string }>;
}

/**
 * Loads shared task categories and displayed statuses.
 * @param opts - Request cancellation options from the page reference query.
 * @example getTaskReferenceData({ signal })
 */
export function getTaskReferenceData(opts?: RequestOptions): Promise<TaskReferenceData> {
  return apiClient.get<TaskReferenceData>('/tasks/reference-data', opts);
}

/**
 * Creates or replaces task details and returns the complete saved task.
 * @param input - Task editor fields using YYYY-MM-DD business dates.
 * @param id - Existing task ID; omit to create.
 * @example setTask(input, 'task-1') // updates an existing task
 */
export function setTask(input: SetTaskInput, id?: Task['id']): Promise<Task> {
  return id ? apiClient.put<Task>(`/tasks/${id}`, input) : apiClient.post<Task>('/tasks', input);
}

/**
 * Changes task dates or assignee and returns the complete saved task.
 * @param id - Task to move or resize.
 * @param input - Inclusive YYYY-MM-DD dates and optional replacement staff ID.
 * @example updateTaskPlacement('task-1', { startDate: '2026-08-10', dueDate: '2026-08-12' })
 */
export function updateTaskPlacement(id: Task['id'], input: TaskPlacementInput): Promise<Task> {
  return apiClient.patch<Task>(`/tasks/${id}/placement`, input);
}

/**
 * Changes task lifecycle state and returns the complete saved task.
 * @param id - Task to complete, cancel, or reopen.
 * @param state - Requested lifecycle state, validated by the backend.
 * @example updateTaskState('task-1', 'completed')
 */
export function updateTaskState(id: Task['id'], state: Task['state']): Promise<Task> {
  return apiClient.patch<Task>(`/tasks/${id}/state`, { state });
}

/**
 * Deletes a task after the backend verifies access and absence of logged hours.
 * @param id - Task to delete.
 * @example deleteTask('task-1')
 */
export function deleteTask(id: Task['id']): Promise<void> {
  return apiClient.delete<void>(`/tasks/${id}`);
}

/**
 * Serializes applied task controls for table and calendar requests.
 * @param params - Endpoint parameters to extend with nonempty filters.
 * @param filters - Applied page search and selected filter IDs.
 * @example applyTaskFilters(params, filters) // adds selected cycleIds without changing range or cursor
 */
export function applyTaskFilters(params: URLSearchParams, filters: TasksFilters): void {
  if (filters.cycleIds.length) params.set('cycleIds', filters.cycleIds.join(','));
  if (filters.staffIds.length) params.set('staffIds', filters.staffIds.join(','));
  if (filters.programIds.length) params.set('programIds', filters.programIds.join(','));
  if (filters.categories.length) params.set('categories', filters.categories.join(','));
  if (filters.statuses.length) params.set('statuses', filters.statuses.join(','));
  if (filters.search) params.set('search', filters.search);
}
