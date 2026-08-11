import { useMemo, useRef } from 'react';
import type { ResourcePeriodData } from '../../../../common/components/ResourceCalendar/types';
import type { TimesheetItem } from '../../../../common/features/timeEntries/types';
import { timesheetEntryTypeKey, type TimesheetEntryType } from './useTimesheetListData';

const DEFAULT_PROGRAM_ID = 'general';
const KEY_SEPARATOR = '\u0000';
const KEY_GROUP_SEPARATOR = '\u0001';

interface CachedResource {
  source: Record<string, readonly TimesheetItem[]>;
  filtered: Record<string, readonly TimesheetItem[]>;
}

interface FilterCache {
  filterKey: string;
  resources: Map<string, CachedResource>;
}

function buildFilterKey(
  categoryFilters: readonly string[],
  programFilters: readonly string[],
  typeFilters: readonly TimesheetEntryType[],
  cycleId?: string,
) {
  return [
    categoryFilters.join(KEY_SEPARATOR),
    programFilters.join(KEY_SEPARATOR),
    typeFilters.join(KEY_SEPARATOR),
    cycleId ?? '',
  ].join(KEY_GROUP_SEPARATOR);
}

function matchesFilters(
  item: TimesheetItem,
  categoryFilters: readonly string[],
  programFilters: readonly string[],
  typeFilters: readonly TimesheetEntryType[],
  cycleId?: string,
) {
  const matchesCategory = !categoryFilters.length || categoryFilters.includes(item.category);
  const matchesProgram = !programFilters.length
    || programFilters.includes(item.programId ?? DEFAULT_PROGRAM_ID);
  const matchesCycle = !cycleId || item.cycleId === cycleId;
  const matchesType = !typeFilters.length || typeFilters.includes(timesheetEntryTypeKey(item));
  return matchesCategory && matchesProgram && matchesType && matchesCycle;
}

function filterPeriods(
  periods: Record<string, readonly TimesheetItem[]>,
  categoryFilters: readonly string[],
  programFilters: readonly string[],
  typeFilters: readonly TimesheetEntryType[],
  cycleId?: string,
) {
  return Object.fromEntries(
    Object.entries(periods).map(([periodKey, items]) => [
      periodKey,
      items.filter(item => matchesFilters(item, categoryFilters, programFilters, typeFilters, cycleId)),
    ]),
  );
}

export function useFilteredTimesheetData(
  data: ResourcePeriodData<TimesheetItem>,
  categoryFilters: readonly string[],
  programFilters: readonly string[],
  typeFilters: readonly TimesheetEntryType[],
  cycleId?: string,
) {
  const cacheRef = useRef<FilterCache>({ filterKey: '', resources: new Map() });
  const filterKey = buildFilterKey(categoryFilters, programFilters, typeFilters, cycleId);
  const hasFilters = categoryFilters.length > 0 || programFilters.length > 0 || typeFilters.length > 0 || Boolean(cycleId);

  return useMemo<ResourcePeriodData<TimesheetItem>>(() => {
    if (!hasFilters) return data;

    const previousResources = cacheRef.current.filterKey === filterKey
      ? cacheRef.current.resources
      : new Map<string, CachedResource>();
    const nextResources = new Map<string, CachedResource>();
    const filteredData = Object.fromEntries(
      Object.entries(data).map(([resourceId, periods]) => {
        const cached = previousResources.get(resourceId);
        if (cached?.source === periods) {
          nextResources.set(resourceId, cached);
          return [resourceId, cached.filtered];
        }

        const filtered = filterPeriods(periods, categoryFilters, programFilters, typeFilters, cycleId);
        nextResources.set(resourceId, { source: periods, filtered });
        return [resourceId, filtered];
      }),
    );

    cacheRef.current = { filterKey, resources: nextResources };
    return filteredData;
  }, [categoryFilters, cycleId, data, filterKey, hasFilters, programFilters, typeFilters]);
}
