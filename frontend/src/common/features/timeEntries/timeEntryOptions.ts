import type { TimeEntryCategory } from './types';

export const TIME_ENTRY_CATEGORY_OPTIONS: Array<{ value: TimeEntryCategory; label: string }> = [
  { value: 'program_delivery', label: 'Program Delivery' },
  { value: 'planning_prep', label: 'Planning / Prep' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'administration', label: 'Administration' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

export const OTHER_TIME_ENTRY_CATEGORY_OPTIONS = TIME_ENTRY_CATEGORY_OPTIONS.filter(
  option => option.value !== 'program_delivery',
);
