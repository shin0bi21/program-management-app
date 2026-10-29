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

export type { StaffReference as StaffResource, ProgramReference as HoursProgram } from '../../../common/features/referenceData/referenceData.api';
export interface HoursCycle { id: string; name: string; state?: 'active' | 'upcoming' | 'completed' }
export interface HoursEntry {
  id: string;
  staffId: string;
  programId: string | null;
  programName: string | null;
  cycleId: string;
  cycleName: string;
  cycleStartsOn: string;
  cycleEndsOn: string;
  category: HoursCategory;
  categoryLabel: string;
  taskId: string | null;
  taskTitle: string | null;
  sessionId: string | null;
  sessionLabel: string | null;
  workDate: string;
  hours: number;
  note: string;
}

export type HoursItem = Omit<
  HoursEntry,
  'staffId' | 'workDate' | 'cycleStartsOn' | 'cycleEndsOn'
>;

export interface HoursTableRow {
  id: string;
  resourceId: string;
  date: string;
  item: HoursItem;
  staffFirstName: string;
  staffLastName: string;
  staffName: string;
}

// Table and filter values.
export const HOURS_TABLE_KEYS = ['firstName', 'lastName', 'date', 'program', 'cycle', 'category', 'hours', 'note', 'type'] as const;
export type HoursSortKey = typeof HOURS_TABLE_KEYS[number];
export type HoursEntryType = 'task' | 'session' | 'other';

export interface HoursFilters {
  dateRange?: DateRange;
  staffIds: string[];
  categories: HoursCategory[];
  programIds: string[];
  types: HoursEntryType[];
  cycleIds?: string[];
  search: string;
}

export type HoursEntryTarget = { resourceId: string; date: string; item: HoursItem };

export type HoursEntryMove = {
  item: HoursItem;
  source: { resourceId: string; date: string };
  destination: { resourceId: string; date: string };
};

export interface HoursCalendarCache {
  upsert: (resourceId: string, date: string, item: HoursItem) => void;
  remove: (itemId: string) => void;
}
