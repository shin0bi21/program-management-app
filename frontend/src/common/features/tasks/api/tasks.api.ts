import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type { SetTaskInput, Task, TaskCategory, TaskOptions, TaskPlacementInput } from '../types';
import type { CursorPage, CursorRequest } from '../../../types/pagination';

export interface TaskFilters {
  staffId?: string;
  category?: TaskCategory;
  start?: string;
  end?: string;
  includeClosed?: boolean;
}

export function getTasks(filters: TaskFilters = {}, opts?: RequestOptions) {
  const params = new URLSearchParams();
  if (filters.staffId) params.set('staffId', filters.staffId);
  if (filters.category) params.set('category', filters.category);
  if (filters.start) params.set('start', filters.start);
  if (filters.end) params.set('end', filters.end);
  if (filters.includeClosed) params.set('includeClosed', 'true');
  const query = params.size ? `?${params}` : '';
  return apiClient.get<Task[]>(`/tasks${query}`, opts);
}

export interface TaskListFilters {
  staffIds: string[]; programIds: string[]; categories: TaskCategory[]; statuses: Task['status'][]; search?: string;
}

export function getTaskList(filters: TaskListFilters, opts: RequestOptions | undefined, pagination: CursorRequest) {
  const params = new URLSearchParams({
    sort: pagination.key, direction: pagination.direction, limit: String(pagination.limit ?? 25),
  });
  if (pagination.cursor) params.set('cursor', pagination.cursor);
  if (filters.staffIds.length) params.set('staffIds', filters.staffIds.join(','));
  if (filters.programIds.length) params.set('programIds', filters.programIds.join(','));
  if (filters.categories.length) params.set('categories', filters.categories.join(','));
  if (filters.statuses.length) params.set('statuses', filters.statuses.join(','));
  if (filters.search) params.set('search', filters.search);
  return apiClient.get<CursorPage<Task>>(`/tasks/list?${params}`, opts);
}

export function getTaskOptions(opts?: RequestOptions) {
  return apiClient.get<TaskOptions>('/tasks/options', opts);
}

export function createTask(input: SetTaskInput) {
  return apiClient.post<Task>('/tasks', input);
}

export function updateTask(id: string, input: SetTaskInput) {
  return apiClient.put<Task>(`/tasks/${id}`, input);
}

export function updateTaskStatus(id: string, status: Task['status']) {
  return apiClient.patch<Task>(`/tasks/${id}/status`, { status });
}

export function updateTaskPlacement(id: string, input: TaskPlacementInput) {
  return apiClient.patch<Task>(`/tasks/${id}/placement`, input);
}

export function deleteTask(id: string) {
  return apiClient.delete<void>(`/tasks/${id}`);
}
