import type { DateRange } from '../../../common/utils/dateRange';
import type { HoursCategory } from '../Hours/types';

// Domain values and types.
type TaskState = 'open' | 'completed' | 'cancelled';
export type TaskStatus = 'upcoming' | 'in_progress' | 'overdue' | Exclude<TaskState, 'open'>;

export interface Task {
  id: string;
  title: string;
  details: string | null;
  category: HoursCategory;
  categoryLabel: string;
  programId: string | null;
  program: string | null;
  state: TaskState;
  status: TaskStatus;
  statusLabel: string;
  startDate: string;
  dueDate: string;
  hoursLogged: number;
  loggedHoursByDate: Array<{ date: string; hours: number }>;
  completedAt: string | null;
  staffId: string;
  firstName: string;
  lastName: string;
  writable: boolean;
}

// Applied controls shared by task collection views.
export interface TasksFilters {
  cycleIds: string[];
  search: string;
  staffIds: string[];
  programIds: string[];
  categories: Task['category'][];
  statuses: TaskStatus[];
}

// Shared table contracts.
export const TASK_TABLE_KEYS = [
  'firstName',
  'lastName',
  'title',
  'category',
  'program',
  'startDate',
  'dueDate',
  'status',
] as const;
export type TaskSortKey = typeof TASK_TABLE_KEYS[number];

// Page state and actions.
export type TaskActions = {
  isTaskPending: (taskId: Task['id']) => boolean;
  setState: (task: Task, state: Task['state']) => Promise<void>;
  setTaskRange: (
    task: Task,
    nextRange: DateRange,
    action: 'move' | 'resize',
    staffId?: Task['staffId'],
  ) => Promise<Task | null>;
  edit: (task: Task) => void;
  requestDelete: (task: Task) => void;
};

export interface TaskCalendarCache {
  upsert: (task: Task) => void;
  remove: (taskId: string) => void;
}

export type AddTaskFormContext = Partial<Pick<Task, 'startDate' | 'dueDate' | 'staffId'>>;

export type TaskModalState =
  | { mode: 'add'; context: AddTaskFormContext }
  | { mode: 'edit'; task: Task }
  | null;
