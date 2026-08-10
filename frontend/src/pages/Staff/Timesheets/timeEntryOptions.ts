import type { TimeEntryTask } from './types';

export const TIME_ENTRY_TASK_OPTIONS: Array<{ value: TimeEntryTask; label: string }> = [
  { value: 'programming', label: 'Programming' },
  { value: 'planning_prep', label: 'Planning / Prep' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'administration', label: 'Administration' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];
