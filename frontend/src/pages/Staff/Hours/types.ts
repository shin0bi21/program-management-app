import type { ListSort } from '../../../common/types/pagination';

// Domain values and records.
export type HoursCategory =
  | 'program_delivery'
  | 'planning_prep'
  | 'meeting'
  | 'administration'
  | 'outreach'
  | 'maintenance'
  | 'other';

export interface StaffResource {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  writable: boolean;
}

export interface HoursProgram { id: string; name: string }
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
export type HoursView = 'calendar' | 'table';
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

export interface HoursPreferences {
  view: HoursView;
  staffIds: string[];
  programIds: string[];
  categories: HoursCategory[];
  types: HoursEntryType[];
  cycleId: string | null;
  sorting: ListSort<HoursSortKey>;
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
}
