import type { TimeEntryListRowResponse } from '../../../common/features/timeEntries/timeEntries.api';
import type { TimeEntryCategory, TimesheetItem } from '../../../common/features/timeEntries/types';
import type { ListSort } from '../../../common/types/pagination';

export type TimesheetSortKey = 'firstName' | 'lastName' | 'date' | 'program' | 'cycle' | 'category' | 'session' | 'hours' | 'note' | 'type';
export type TimesheetEntryType = 'task' | 'session' | 'other';
export type TimesheetListRow = TimeEntryListRowResponse;
export type TimesheetView = 'calendar' | 'list';
export type TimesheetEntryTarget = { resourceId: string; date: string; item: TimesheetItem };
export type TimesheetEntryMove = {
  item: TimesheetItem;
  source: { resourceId: string; date: string };
  destination: { resourceId: string; date: string };
};
export type TimesheetAddTarget = {
  resourceId?: string;
  date?: string;
  source?: 'regular' | 'task' | 'session';
};

export interface TimesheetCalendarCache {
  upsert: (resourceId: string, date: string, item: TimesheetItem) => void;
  remove: (itemId: string) => void;
}

export interface TimesheetPreference {
  view: TimesheetView;
  staffIds: string[];
  programIds: string[];
  categories: TimeEntryCategory[];
  types?: TimesheetEntryType[];
  cycleId: string | null;
  sorting?: ListSort<TimesheetSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}

export interface TimesheetPreferences {
  view: TimesheetView;
  staffIds: string[];
  programIds: string[];
  categories: TimeEntryCategory[];
  types: TimesheetEntryType[];
  cycleId: string | null;
  sorting: ListSort<TimesheetSortKey>;
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
}
