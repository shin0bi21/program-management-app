import type { DateRange } from '../../../common/utils/dateRange';

export interface Hours {
  id: string;
  staffId: string;
  programId: string | null;
  category:
    | 'program_delivery'
    | 'planning_prep'
    | 'meeting'
    | 'administration'
    | 'outreach'
    | 'maintenance'
    | 'other';
  date: string;
  hours: number;
  note: string;
  taskId: string | null;
  sessionId: string | null;

  firstName: string;
  lastName: string;

  program: string | null;

  cycleId: string;
  cycle: string;
  cycleStartsOn: string;
  cycleEndsOn: string;

  taskTitle: string | null;

  sessionTitle: string | null;

  categoryLabel: string;
  type: 'task' | 'session' | 'regular';
}
export type HoursCategory = Hours['category'];

export type { StaffReference, ProgramReference as HoursProgram } from '../../../common/features/referenceData/referenceData.api';
export interface HoursCycle { id: string; name: string; state?: 'active' | 'upcoming' | 'completed' }

// Table and filter values.
export const HOURS_TABLE_KEYS = ['firstName', 'lastName', 'date', 'program', 'cycle', 'category', 'hours', 'note', 'type'] as const;
export type HoursSortKey = typeof HOURS_TABLE_KEYS[number];
export type HoursItemType = Hours['type'];

export interface HoursFilters {
  dateRange?: DateRange;
  staffIds: Hours['staffId'][];
  categories: HoursCategory[];
  programIds: NonNullable<Hours['programId']>[];
  types: HoursItemType[];
  cycleIds?: Hours['cycleId'][];
  search: string;
}

export interface HoursItemMove {
  item: Hours;
  date: string;
}

export interface HoursCalendarIndex {
  upsert: (item: Hours) => void;
  remove: (itemId: string) => void;
}
