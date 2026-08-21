import type { Task, TaskCategory, TaskListStatus } from '../../../common/features/tasks/types';
import type { ListSort } from '../../../common/types/pagination';

export const TASK_TABLE_KEYS = ['firstName', 'lastName', 'title', 'category', 'program', 'startDate', 'dueDate', 'status'] as const;
export type TaskSortKey = typeof TASK_TABLE_KEYS[number];
export type TasksView = 'calendar' | 'table';

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

export type StoredTaskPreferences = Partial<TaskPreferences>;

export interface TaskCalendarCache {
  upsert: (task: Task) => void;
  remove: (taskId: string) => void;
}

export interface AddTaskModalInitialValues {
  startDate: string;
  dueDate: string;
  fixedStaffId?: string;
}

export type TaskModalState =
  | { mode: 'add'; initialValues: AddTaskModalInitialValues }
  | { mode: 'edit'; task: Task }
  | null;

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
