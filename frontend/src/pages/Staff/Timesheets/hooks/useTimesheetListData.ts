import { useMemo } from 'react';
import type { ResourcePeriodData } from '../../../../common/components/ResourceCalendar/types';
import type { StaffResource, TimesheetItem } from '../../../../common/features/timeEntries/types';
import type { ListSort } from '../../../../common/types/pagination';

export type TimesheetSortKey = 'firstName' | 'lastName' | 'date' | 'program' | 'cycle' | 'category' | 'session' | 'hours' | 'note' | 'type';
export type TimesheetEntryType = 'task' | 'session' | 'other';

export interface TimesheetListRow {
  id: string;
  resourceId: string;
  date: string;
  item: TimesheetItem;
  staffFirstName: string;
  staffLastName: string;
  staffName: string;
}

export function buildTimesheetListRows(data: ResourcePeriodData<TimesheetItem>, resources: readonly StaffResource[], staffFilters: readonly string[]) {
  const resourcesById = new Map(resources.map(resource => [resource.id, resource]));
  return Object.entries(data).flatMap(([resourceId, periods]) => {
    if (staffFilters.length && !staffFilters.includes(resourceId)) return [];
    const resource = resourcesById.get(resourceId);
    if (!resource) throw new Error(`Timesheet data references unknown staff resource ${resourceId}.`);
    return Object.entries(periods).flatMap(([date, items]) => items.map(item => ({
      id: item.id,
      resourceId,
      date,
      item,
      staffFirstName: resource.firstName,
      staffLastName: resource.lastName,
      staffName: resource.name,
    })));
  });
}

function sortValue(row: TimesheetListRow, key: TimesheetSortKey): string | number {
  const values: Record<TimesheetSortKey, string | number> = {
    firstName: row.staffFirstName,
    lastName: row.staffLastName,
    date: row.date,
    program: row.item.programName ?? '',
    cycle: row.item.cycleName ?? '',
    category: row.item.categoryLabel,
    session: row.item.sessionLabel ?? '',
    hours: row.item.hours,
    note: row.item.note,
    type: timesheetEntryType(row.item),
  };
  return values[key];
}

export function timesheetEntryType(item: TimesheetItem) {
  return item.taskId ? 'Task' : item.sessionId ? 'Session' : 'Other';
}

export function timesheetEntryTypeKey(item: TimesheetItem): TimesheetEntryType {
  return item.taskId ? 'task' : item.sessionId ? 'session' : 'other';
}

export function sortTimesheetRows(rows: readonly TimesheetListRow[], sorting: ListSort<TimesheetSortKey>) {
  const direction = sorting.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = sortValue(left, sorting.key);
    const rightValue = sortValue(right, sorting.key);
    const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
    return direction * comparison || left.id.localeCompare(right.id);
  });
}

function matchesSearch(row: TimesheetListRow, query: string) {
  return [
    row.date,
    row.staffName,
    row.item.programName ?? 'General',
    row.item.cycleName,
    row.item.categoryLabel,
    row.item.taskTitle ?? '',
    row.item.sessionLabel ?? '',
    row.item.note,
  ].some(value => value.toLocaleLowerCase().includes(query));
}

export function useTimesheetListData(
  data: ResourcePeriodData<TimesheetItem>,
  resources: readonly StaffResource[],
  staffFilters: readonly string[],
  search: string,
  sorting: ListSort<TimesheetSortKey>,
) {
  const rows = useMemo(() => buildTimesheetListRows(data, resources, staffFilters), [data, resources, staffFilters]);
  return useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filteredRows = query ? rows.filter(row => matchesSearch(row, query)) : rows;
    return sortTimesheetRows(filteredRows, sorting);
  }, [rows, search, sorting]);
}
