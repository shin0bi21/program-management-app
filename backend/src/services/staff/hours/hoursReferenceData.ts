import type { HoursCategory } from '../../../validation/hoursSchemas';

export const HOURS_CATEGORY_OPTIONS = [
  { id: 'program_delivery', name: 'Program Delivery' },
  { id: 'planning_prep', name: 'Planning / Prep' },
  { id: 'meeting', name: 'Meeting' },
  { id: 'administration', name: 'Administration' },
  { id: 'outreach', name: 'Outreach' },
  { id: 'maintenance', name: 'Maintenance' },
  { id: 'other', name: 'Other' },
] as const satisfies ReadonlyArray<{ id: HoursCategory; name: string }>;

export const HOURS_ITEM_TYPE_OPTIONS = [
  { id: 'task', name: 'Task' },
  { id: 'session', name: 'Session' },
  { id: 'regular', name: 'Regular' },
] as const;

const categoryLabels = new Map<HoursCategory, string>(
  HOURS_CATEGORY_OPTIONS.map(option => [option.id, option.name]),
);

/**
 * Returns the display name for a validated time-entry category.
 * @param category - Category accepted by the hours schema.
 * @example getHoursCategoryLabel('planning_prep') // 'Planning / Prep'
 */
export function getHoursCategoryLabel(category: HoursCategory) {
  return categoryLabels.get(category)!;
}
