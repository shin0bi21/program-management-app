import type { HoursCategory } from '../../../validation/hoursSchemas';

export const HOURS_CATEGORY_OPTIONS = [
  { value: 'program_delivery', label: 'Program Delivery' },
  { value: 'planning_prep', label: 'Planning / Prep' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'administration', label: 'Administration' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
] as const satisfies ReadonlyArray<{ value: HoursCategory; label: string }>;

export const HOURS_ITEM_TYPE_OPTIONS = [
  { value: 'task', label: 'Task' },
  { value: 'session', label: 'Session' },
  { value: 'regular', label: 'Regular' },
] as const;

const categoryLabels = new Map<HoursCategory, string>(
  HOURS_CATEGORY_OPTIONS.map(option => [option.value, option.label]),
);

export function getHoursCategoryLabel(category: HoursCategory) {
  return categoryLabels.get(category)!;
}
