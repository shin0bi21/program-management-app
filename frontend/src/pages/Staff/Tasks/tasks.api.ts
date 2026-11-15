import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { CursorPage, CursorRequest } from '../../../query/types';
import type { Task, TaskCategory, TaskStatus } from './types';

export interface TasksFilters {
  cycleIds: string[];
  search: string;
  staffIds: string[];
  programIds: string[];
  categories: TaskCategory[];
  statuses: TaskStatus[];
}

export interface SetTaskInput {
  title: string;
  details: string | null;
  category: TaskCategory;
  programId: string | null;
  startDate: string;
  dueDate: string;
  staffId: string;
}

interface TaskPlacementInput {
  startDate: string;
  dueDate: string;
  staffId?: string;
}

export function getTasksTableData(filters: TasksFilters, opts: RequestOptions | undefined, pagination: CursorRequest) {
  const params = new URLSearchParams({
    sort: pagination.key, direction: pagination.direction,
  });
  if (pagination.cursor) params.set('cursor', pagination.cursor);
  applyTaskFilters(params, filters);
  return apiClient.get<CursorPage<Task>>(`/tasks/list?${params}`, opts);
}

export function getTasksCalendarData(
  filters: TasksFilters,
  range: { start: string; end: string },
  opts?: RequestOptions,
) {
  const params = new URLSearchParams({ ...range });
  applyTaskFilters(params, filters);
  return apiClient.get<Task[]>(`/tasks/calendar?${params}`, opts);
}

export function getTaskDashboardData(staffId: string, opts?: RequestOptions) {
  const params = new URLSearchParams();
  params.set('staffId', staffId);
  return apiClient.get<Task[]>(`/tasks?${params}`, opts);
}

function applyTaskFilters(params: URLSearchParams, filters: TasksFilters) {
  if (filters.cycleIds.length) params.set('cycleIds', filters.cycleIds.join(','));
  if (filters.staffIds.length) params.set('staffIds', filters.staffIds.join(','));
  if (filters.programIds.length) params.set('programIds', filters.programIds.join(','));
  if (filters.categories.length) params.set('categories', filters.categories.join(','));
  if (filters.statuses.length) params.set('statuses', filters.statuses.join(','));
  if (filters.search) params.set('search', filters.search);
}

export interface TaskReferenceData {
  categories: Array<{ id: TaskCategory; name: string }>;
  statuses: Array<{ id: TaskStatus; name: string }>;
}

export function getTaskReferenceData(opts?: RequestOptions) {
  return apiClient.get<TaskReferenceData>('/tasks/reference-data', opts);
}

export function getTask(id: string, opts?: RequestOptions) {
  return apiClient.get<Task>(`/tasks/${id}`, opts);
}

export function setTask(input: SetTaskInput, id?: string) {
  return id ? apiClient.put<Task>(`/tasks/${id}`, input) : apiClient.post<Task>('/tasks', input);
}

export function updateTaskState(id: string, state: Task['state']) {
  return apiClient.patch<Task>(`/tasks/${id}/state`, { state });
}

export function updateTaskPlacement(id: string, input: TaskPlacementInput) {
  return apiClient.patch<Task>(`/tasks/${id}/placement`, input);
}

export function deleteTask(id: string) {
  return apiClient.delete<void>(`/tasks/${id}`);
}
