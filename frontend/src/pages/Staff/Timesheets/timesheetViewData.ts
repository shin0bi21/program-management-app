import type { TimeEntryListRowResponse } from '../../../common/features/timeEntries/api/timeEntries.api';
import type { TimesheetItem } from '../../../common/features/timeEntries/types';

export type TimesheetSortKey = 'firstName' | 'lastName' | 'date' | 'program' | 'cycle' | 'category' | 'session' | 'hours' | 'note' | 'type';
export type TimesheetEntryType = 'task' | 'session' | 'other';
export type TimesheetListRow = TimeEntryListRowResponse;

export function timesheetEntryType(item: TimesheetItem) {
  return item.taskId ? 'Task' : item.sessionId ? 'Session' : 'Regular';
}

export function timesheetEntryTypeKey(item: TimesheetItem): TimesheetEntryType {
  return item.taskId ? 'task' : item.sessionId ? 'session' : 'other';
}
