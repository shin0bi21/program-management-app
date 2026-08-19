import type { TimeEntryCategory } from '../../../common/features/timeEntries/types';
import type { ListSort } from '../../../common/types/pagination';
import type { TimesheetEntryType, TimesheetSortKey } from './timesheetViewData';

export interface TimesheetPreference {
  view: 'calendar' | 'list';
  staffIds: string[];
  programIds: string[];
  categories: TimeEntryCategory[];
  types?: TimesheetEntryType[];
  cycleId: string | null;
  sorting?: ListSort<TimesheetSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}
