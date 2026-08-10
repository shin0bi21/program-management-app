import { useMemo, useRef } from 'react';
import type { ResourcePeriodData } from '../../../../common/components/ResourceCalendar/types';
import type { TimesheetItem } from '../types';

interface CachedResource {
  source: Record<string, readonly TimesheetItem[]>;
  filtered: Record<string, readonly TimesheetItem[]>;
}

export function useFilteredTimesheetData(
  data: ResourcePeriodData<TimesheetItem>,
  typeFilters: readonly string[],
  programFilters: readonly string[],
) {
  const cacheRef = useRef<{ filterKey: string; resources: Map<string, CachedResource> }>({
    filterKey: '',
    resources: new Map(),
  });
  const filterKey = `${typeFilters.join('\u0000')}\u0001${programFilters.join('\u0000')}`;

  return useMemo<ResourcePeriodData<TimesheetItem>>(() => {
    if (!typeFilters.length && !programFilters.length) return data;
    const previous = cacheRef.current.filterKey === filterKey
      ? cacheRef.current.resources
      : new Map<string, CachedResource>();
    const next = new Map<string, CachedResource>();
    const filtered = Object.fromEntries(Object.entries(data).map(([resourceId, periods]) => {
      const cached = previous.get(resourceId);
      if (cached?.source === periods) {
        next.set(resourceId, cached);
        return [resourceId, cached.filtered];
      }
      const filteredPeriods = Object.fromEntries(Object.entries(periods).map(([periodKey, items]) => [
        periodKey,
        items.filter(item => (!typeFilters.length || typeFilters.includes(item.task))
          && (!programFilters.length || programFilters.includes(item.programId ?? 'general'))),
      ]));
      next.set(resourceId, { source: periods, filtered: filteredPeriods });
      return [resourceId, filteredPeriods];
    }));
    cacheRef.current = { filterKey, resources: next };
    return filtered;
  }, [data, filterKey, programFilters, typeFilters]);
}
