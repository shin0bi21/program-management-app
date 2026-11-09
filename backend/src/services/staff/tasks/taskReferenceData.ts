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

export type TaskStatus = typeof TASK_STATUS_OPTIONS[number]['value'];
