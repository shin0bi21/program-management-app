import type { DateRange } from '../../../common/utils/dateRange';

export const HOURS_CATEGORIES = [
  'program_delivery',
  'planning_prep',
  'meeting',
  'administration',
  'outreach',
  'maintenance',
  'other',
] as const;

export type HoursCategory = typeof HOURS_CATEGORIES[number];

export interface Hours {
  id: string;
  staffId: string;
  programId: string | null;
  category: HoursCategory;
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

// Table and filter values.
export const HOURS_TABLE_KEYS = ['firstName', 'lastName', 'date', 'program', 'cycle', 'category', 'hours', 'note', 'type'] as const;
export type HoursSortKey = typeof HOURS_TABLE_KEYS[number];

export type AddHoursFormContext = Pick<Hours, 'staffId' | 'date' | 'type'>;

export type HoursActions = {
  isItemPending: (itemId: Hours['id']) => boolean;
  add: (context: AddHoursFormContext) => void;
  edit: (item: Hours) => void;
  move: (item: Hours, date: Hours['date']) => Promise<void>;
  requestDelete: (item: Hours) => void;
};

export interface HoursFilters {
  dateRange?: DateRange;
  staffIds: Hours['staffId'][];
  categories: HoursCategory[];
  programIds: NonNullable<Hours['programId']>[];
  types: Hours['type'][];
  cycleIds?: Hours['cycleId'][];
  search: string;
}

export interface HoursCalendarIndex {
  upsert: (item: Hours) => void;
  remove: (itemId: string) => void;
}
