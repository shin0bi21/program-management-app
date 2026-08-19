import type { Task, TaskCategory, TaskListStatus } from '../../../common/features/tasks/types';
import type { ListSort } from '../../../common/types/pagination';

export type TaskSortKey = 'firstName' | 'lastName' | 'title' | 'category' | 'program' | 'startDate' | 'dueDate' | 'status';
export type TasksView = 'calendar' | 'list';

export interface TaskPreferences {
  view: TasksView;
  staffIds: string[];
  programIds: string[];
  categories: TaskCategory[];
  statuses: TaskListStatus[];
  sorting: ListSort<TaskSortKey>;
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
}

export interface TaskPreference {
  view?: TasksView;
  staffIds?: string[];
  programIds: string[];
  categories: TaskCategory[];
  statuses: TaskListStatus[];
  sorting?: ListSort<TaskSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}

export interface TaskCalendarCache {
  upsert: (task: Task) => void;
  remove: (taskId: string) => void;
}

export type TaskModalTarget = Task | {
  startDate: string;
  dueDate: string;
  fixedStaffId?: string;
};

export interface TaskCalendarActions {
  isTaskPending: (taskId: string) => boolean;
  requestDelete: (task: Task) => void;
  setStatus: (task: Task, status: Task['status']) => Promise<void>;
  setTaskRange: (
    task: Task,
    nextRange: { start: string; end: string },
    action: 'move' | 'resize',
    staffId?: string,
  ) => Promise<Task | null>;
}
