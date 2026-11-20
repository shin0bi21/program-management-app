import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type { Task, TaskCategory, TaskStatus, TasksFilters } from '../types';

export interface SetTaskInput {
  title: string;
  details: string | null;
  category: TaskCategory;
  programId: string | null;
  startDate: string;
  dueDate: string;
  staffId: string;
}

/**
 * Loads accessible open tasks for a staff overview or Hours task choices.
 * @param staffId - Staff member whose open tasks are requested.
 * @param opts - Request cancellation options from the consuming query.
 * @example getOpenTasks('staff-1', { signal })
 */
export function getOpenTasks(staffId: string, opts?: RequestOptions): Promise<Task[]> {
  const params = new URLSearchParams();
  params.set('staffId', staffId);
  return apiClient.get<Task[]>(`/tasks?${params}`, opts);
}

export interface TaskReferenceData {
  categories: Array<{ id: TaskCategory; name: string }>;
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
export function setTask(input: SetTaskInput, id?: string): Promise<Task> {
  return id ? apiClient.put<Task>(`/tasks/${id}`, input) : apiClient.post<Task>('/tasks', input);
}

/**
 * Changes task lifecycle state and returns the complete saved task.
 * @param id - Task to complete, cancel, or reopen.
 * @param state - Requested lifecycle state, validated by the backend.
 * @example updateTaskState('task-1', 'completed')
 */
export function updateTaskState(id: string, state: Task['state']): Promise<Task> {
  return apiClient.patch<Task>(`/tasks/${id}/state`, { state });
}

/**
 * Deletes a task after the backend verifies access and absence of logged hours.
 * @param id - Task to delete.
 * @example deleteTask('task-1')
 */
export function deleteTask(id: string): Promise<void> {
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
