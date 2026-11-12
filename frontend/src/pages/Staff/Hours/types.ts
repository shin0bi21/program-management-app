import type { DateRange } from '../../../common/utils/dateRange';
// Domain values and records.
export type HoursCategory =
  | 'program_delivery'
  | 'planning_prep'
  | 'meeting'
  | 'administration'
  | 'outreach'
  | 'maintenance'
  | 'other';

export type { StaffReference, ProgramReference as HoursProgram } from '../../../common/features/referenceData/referenceData.api';
export interface HoursCycle { id: string; name: string; state?: 'active' | 'upcoming' | 'completed' }
export interface HoursItem {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  name: string;
  programId: string | null;
  program: string | null;
  cycleId: string;
  cycle: string;
  cycleStartsOn: string;
  cycleEndsOn: string;
  category: HoursCategory;
  categoryLabel: string;
  taskId: string | null;
  taskTitle: string | null;
  sessionId: string | null;
  sessionLabel: string | null;
  date: string;
  type: HoursItemType;
  hours: number;
  note: string;
}

// Table and filter values.
export const HOURS_TABLE_KEYS = ['firstName', 'lastName', 'date', 'program', 'cycle', 'category', 'hours', 'note', 'type'] as const;
export type HoursSortKey = typeof HOURS_TABLE_KEYS[number];
export type HoursItemType = 'task' | 'session' | 'regular';

export interface HoursFilters {
  dateRange?: DateRange;
  staffIds: string[];
  categories: HoursCategory[];
  programIds: string[];
  types: HoursItemType[];
  cycleIds?: string[];
  search: string;
}

export interface HoursItemMove {
  item: HoursItem;
  date: string;
}

export interface HoursCalendarIndex {
  upsert: (item: HoursItem) => void;
  remove: (itemId: string) => void;
}
