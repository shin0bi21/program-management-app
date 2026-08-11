import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type { SetTaskInput, Task, TaskCategory, TaskOptions, TaskPlacementInput } from '../types';

export interface TaskFilters {
  staffId?: string;
  category?: TaskCategory;
  includeClosed?: boolean;
}

export function getTasks(filters: TaskFilters = {}, opts?: RequestOptions) {
  const params = new URLSearchParams();
  if (filters.staffId) params.set('staffId', filters.staffId);
  if (filters.category) params.set('category', filters.category);
  if (filters.includeClosed) params.set('includeClosed', 'true');
  const query = params.size ? `?${params}` : '';
  return apiClient.get<Task[]>(`/tasks${query}`, opts);
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
