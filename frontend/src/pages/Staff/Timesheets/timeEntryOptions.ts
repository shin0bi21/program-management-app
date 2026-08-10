import type { TimeEntryTask } from './types';

export const TIME_ENTRY_TASK_OPTIONS: Array<{ value: TimeEntryTask; label: string }> = [
  { value: 'program_delivery', label: 'Program Delivery' },
  { value: 'planning_prep', label: 'Planning / Prep' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'administration', label: 'Administration' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];
