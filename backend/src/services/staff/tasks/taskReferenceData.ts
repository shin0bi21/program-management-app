import type { TaskRow } from './taskRowQuery';

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
  { value: 'in_progress', label: 'In Progress' },
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

/**
 * Returns the display label for a task category.
 * @param category - Stored task category.
 * @example getTaskCategoryLabel('meeting') // 'Meeting'
 */
export function getTaskCategoryLabel(category: TaskCategory) {
  return categoryLabels.get(category)!;
}

/**
 * Returns a task's displayed status using its dates and lifecycle state.
 * @param task - Stored task state and inclusive dates.
 * @param today - Calendar date; defaults to today in Toronto.
 * @example getTaskStatus(openTask, '2026-08-10') // date-derived status
 */
export function getTaskStatus(
  task: Pick<TaskRow, 'state' | 'startDate' | 'dueDate'>,
  today = getCurrentTorontoDate(),
): TaskStatus {
  if (task.state !== 'open') return task.state;
  if (task.startDate > today) return 'upcoming';
  if (task.dueDate < today) return 'overdue';
  return 'in_progress';
}

/**
 * Returns the display label for a task status.
 * @param status - Displayed task status.
 * @example getTaskStatusLabel('in_progress') // 'In Progress'
 */
export function getTaskStatusLabel(status: TaskStatus) {
  return statusLabels.get(status)!;
}

/**
 * Returns today's calendar date in Toronto.
 * @example getCurrentTorontoDate() // YYYY-MM-DD
 */
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
