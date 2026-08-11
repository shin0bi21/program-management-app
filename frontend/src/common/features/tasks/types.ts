export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';
export type TaskCategory = 'program_delivery' | 'planning_prep' | 'meeting' | 'administration' | 'outreach' | 'maintenance' | 'other';
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  program_delivery: 'Program Delivery',
  planning_prep: 'Planning / Prep',
  meeting: 'Meeting',
  administration: 'Administration',
  outreach: 'Outreach',
  maintenance: 'Maintenance',
  other: 'Other',
};
export const TASK_CATEGORY_OPTIONS: Array<{ value: TaskCategory; label: string }> = [
  { value: 'program_delivery', label: TASK_CATEGORY_LABELS.program_delivery },
  { value: 'planning_prep', label: TASK_CATEGORY_LABELS.planning_prep },
  { value: 'meeting', label: TASK_CATEGORY_LABELS.meeting },
  { value: 'administration', label: TASK_CATEGORY_LABELS.administration },
  { value: 'outreach', label: TASK_CATEGORY_LABELS.outreach },
  { value: 'maintenance', label: TASK_CATEGORY_LABELS.maintenance },
  { value: 'other', label: TASK_CATEGORY_LABELS.other },
];

export interface TaskAssignee {
  id: string;
  name: string;
}

export interface TaskResource { id: string; name: string; role: string; writable: boolean }
export interface TaskProgram { id: string; name: string }
export interface TaskCycle {
  id: string;
  name: string;
  programId: string;
  startsOn: string;
  endsOn: string;
  state: 'upcoming' | 'active' | 'completed';
}
export interface TaskOptions { resources: TaskResource[]; programs: TaskProgram[]; cycles: TaskCycle[] }

export interface Task {
  id: string;
  title: string;
  details: string | null;
  category: TaskCategory;
  programId: string | null;
  programName: string | null;
  cycleId: string;
  cycleName: string;
  status: TaskStatus;
  startDate: string;
  dueDate: string;
  hoursLogged: number;
  loggedHoursByDate: Array<{ date: string; hours: number }>;
  completedAt: string | null;
  assignee: TaskAssignee;
  writable: boolean;
}

export interface SetTaskInput {
  title: string;
  details: string | null;
  category: TaskCategory;
  programId: string | null;
  cycleId: string;
  status: TaskStatus;
  startDate: string;
  dueDate: string;
  staffId: string;
}

export interface TaskPlacementInput {
  startDate: string;
  dueDate: string;
  staffId?: string;
}
