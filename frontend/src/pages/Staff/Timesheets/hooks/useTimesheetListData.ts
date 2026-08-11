import { useMemo } from 'react';
import type { ResourcePeriodData } from '../../../../common/components/ResourceCalendar/types';
import type { StaffResource, TimesheetItem } from '../../../../common/features/timeEntries/types';

export interface TimesheetListRow {
  id: string;
  resourceId: string;
  date: string;
  item: TimesheetItem;
  staffName: string;
}

export function buildTimesheetListRows(data: ResourcePeriodData<TimesheetItem>, resources: readonly StaffResource[], staffFilters: readonly string[]) {
  const resourceNames = new Map(resources.map(resource => [resource.id, resource.name]));
  return Object.entries(data).flatMap(([resourceId, periods]) => {
    if (staffFilters.length && !staffFilters.includes(resourceId)) return [];
    const staffName = resourceNames.get(resourceId);
    if (!staffName) throw new Error(`Timesheet data references unknown staff resource ${resourceId}.`);
    return Object.entries(periods).flatMap(([date, items]) => items.map(item => ({
      id: item.id,
      resourceId,
      date,
      item,
      staffName,
    })));
  }).sort((left, right) => right.date.localeCompare(left.date) || left.staffName.localeCompare(right.staffName));
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
) {
  const rows = useMemo(() => buildTimesheetListRows(data, resources, staffFilters), [data, resources, staffFilters]);
  return useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? rows.filter(row => matchesSearch(row, query)) : rows;
  }, [rows, search]);
}
