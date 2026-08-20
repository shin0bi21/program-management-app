import type { HoursListRowResponse } from '../../../common/features/hours/hours.api';
import type { HoursCategory, HoursItem } from '../../../common/features/hours/types';
import type { ListSort } from '../../../common/types/pagination';

export type HoursSortKey = 'firstName' | 'lastName' | 'date' | 'program' | 'cycle' | 'category' | 'session' | 'hours' | 'note' | 'type';
export type HoursEntryType = 'task' | 'session' | 'other';
export type HoursListRow = HoursListRowResponse;
export type HoursView = 'calendar' | 'list';
export type HoursEntryTarget = { resourceId: string; date: string; item: HoursItem };
export type HoursEntryMove = {
  item: HoursItem;
  source: { resourceId: string; date: string };
  destination: { resourceId: string; date: string };
};
export type HoursAddTarget = {
  resourceId?: string;
  date?: string;
  source?: 'regular' | 'task' | 'session';
};
export type HoursModalState =
  | { mode: 'add'; initialValues: HoursAddTarget }
  | { mode: 'edit'; target: HoursEntryTarget }
  | null;

export interface HoursCalendarCache {
  upsert: (resourceId: string, date: string, item: HoursItem) => void;
  remove: (itemId: string) => void;
}

export interface HoursPreference {
  view: HoursView;
  staffIds: string[];
  programIds: string[];
  categories: HoursCategory[];
  types?: HoursEntryType[];
  cycleId: string | null;
  sorting?: ListSort<HoursSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
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
