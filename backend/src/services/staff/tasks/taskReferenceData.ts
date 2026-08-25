import type { TaskRow } from './taskRecordQuery';

export const TASK_CATEGORY_OPTIONS = [
  { value: 'program_delivery', label: 'Program Delivery' },
  { value: 'planning_prep', label: 'Planning / Prep' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'administration', label: 'Administration' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
] as const;

export const TASK_STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

type TaskCategory = typeof TASK_CATEGORY_OPTIONS[number]['value'];
export type TaskStatus = typeof TASK_STATUS_OPTIONS[number]['value'];

const categoryLabels = new Map<TaskCategory, string>(
  TASK_CATEGORY_OPTIONS.map(option => [option.value, option.label]),
);
const statusLabels = new Map<TaskStatus, string>(
  TASK_STATUS_OPTIONS.map(option => [option.value, option.label]),
);

export function getTaskCategoryLabel(category: TaskCategory) {
  return categoryLabels.get(category)!;
}

export function getTaskStatus(
  task: Pick<TaskRow, 'status' | 'startDate' | 'dueDate'>,
  today = getCurrentTorontoDate(),
): TaskStatus {
  if (task.status !== 'open') return task.status;
  if (task.startDate > today) return 'upcoming';
  if (task.dueDate < today) return 'overdue';
  return 'active';
}

export function getTaskStatusLabel(status: TaskStatus) {
  return statusLabels.get(status)!;
}

function getCurrentTorontoDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
