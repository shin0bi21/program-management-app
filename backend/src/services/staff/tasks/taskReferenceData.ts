export { HOURS_CATEGORY_OPTIONS as TASK_CATEGORY_OPTIONS } from '../hours/hoursReferenceData';

export const TASK_STATUS_OPTIONS = [
  { id: 'upcoming', name: 'Upcoming' },
  { id: 'in_progress', name: 'In Progress' },
  { id: 'overdue', name: 'Overdue' },
  { id: 'completed', name: 'Completed' },
  { id: 'cancelled', name: 'Cancelled' },
] as const;

export type TaskStatus = typeof TASK_STATUS_OPTIONS[number]['id'];
