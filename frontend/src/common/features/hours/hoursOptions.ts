import type { HoursCategory } from './types';

export const HOURS_CATEGORY_OPTIONS: Array<{ value: HoursCategory; label: string }> = [
  { value: 'program_delivery', label: 'Program Delivery' },
  { value: 'planning_prep', label: 'Planning / Prep' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'administration', label: 'Administration' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

export const OTHER_HOURS_CATEGORY_OPTIONS = HOURS_CATEGORY_OPTIONS.filter(
  option => option.value !== 'program_delivery',
);
