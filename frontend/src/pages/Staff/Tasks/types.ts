// Domain values and types.
export type TaskState = 'open' | 'completed' | 'cancelled';
export type TaskTiming = 'upcoming' | 'in_progress' | 'overdue';
export type TaskStatus = TaskTiming | Exclude<TaskState, 'open'>;
export type TaskCategory =
  | 'program_delivery'
  | 'planning_prep'
  | 'meeting'
  | 'administration'
  | 'outreach'
  | 'maintenance'
  | 'other';

export interface Task {
  id: string;
  title: string;
  details: string | null;
  category: TaskCategory;
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
  name: string;
  writable: boolean;
}

// Shared task data contracts.
export type { StaffReference as TaskResource, ProgramReference as TaskProgram } from '../../../common/features/referenceData/referenceData.api';

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
export interface TaskCalendarCache {
  upsert: (task: Task) => void;
  remove: (taskId: string) => void;
}

export interface AddTaskModalInitialValues {
  startDate: string;
  dueDate: string;
  staffId?: string;
}

export type TaskModalState =
  | { mode: 'add'; initialValues: AddTaskModalInitialValues }
  | { mode: 'edit'; task: Task }
  | null;
