import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useCycleReferences, useProgramReferences, useStaffReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { getHoursReferenceData } from '../../hours.api';
import { createRecordStore } from '../../../../../query/createRecordStore';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import type { HoursItem, HoursSortKey } from '../../types';

/**
 * Supplies the server-compatible value for the selected Hours table order.
 * @param item - Complete saved hours record.
 * @param key - Column selected for ordering.
 * @example getHoursSortValue(item, 'hours') // numeric hours
 */
export function getHoursSortValue(item: HoursItem, key: HoursSortKey) {
  const value = item[key];
  return typeof value === 'string' ? value.toLowerCase() : value ?? '';
}

export const hoursData = createRecordStore<HoursItem>({
  queryKey: ['hours', 'records'],
  listKey: ['hours', 'table'],
  getSortValue: (item, queryKey) => {
    const sorting = queryKey[queryKey.length - 1] as ListSort<HoursSortKey>;
    return getHoursSortValue(item, sorting.key);
  },
});

/**
 * Supplies current saved Hours records and shared staff, program, cycle, and hour choices.
 * @param referenceDataQueryKey - Cache key for hour categories and source types.
 * @param currentUserId - Signed-in staff member used to resolve the default resource.
 * @example const { records, resources, cycles } = useHoursData(['hours-reference-data'], userId)
 */
export default function useHoursData(
  referenceDataQueryKey: readonly unknown[],
  currentUserId?: string,
) {
  const records = hoursData.useRecords();
  const referenceDataQuery = useQuery({
    queryKey: referenceDataQueryKey,
    queryFn: ({ signal }) => getHoursReferenceData({ signal }),
  });
  const cyclesQuery = useCycleReferences();
  const programsQuery = useProgramReferences();
  const staffQuery = useStaffReferences('hours');
  const resources = staffQuery.rows;
  const writableResources = useMemo(
    () => resources?.filter(resource => resource.writable) ?? [],
    [resources],
  );
  const resourcesById = useMemo(
    () => new Map(resources?.map(resource => [resource.id, resource]) ?? []),
    [resources],
  );

  return {
    records,
    resources: resources ?? [],
    writableResources,
    resourcesById,
    programs: programsQuery.rows,
    categories: referenceDataQuery.data?.categories ?? [],
    types: referenceDataQuery.data?.types ?? [],
    currentUserResource: currentUserId ? resourcesById.get(currentUserId) ?? null : null,
    optionsLoading: referenceDataQuery.isLoading || programsQuery.loading || staffQuery.loading,
    optionsError: referenceDataQuery.error || programsQuery.error || staffQuery.error,
    resourcesError: staffQuery.error,
    programsError: programsQuery.error,
    localOptionsError: referenceDataQuery.error,
    cycles: cyclesQuery.rows,
    cyclesLoading: cyclesQuery.loading,
    cyclesError: cyclesQuery.error,
  };
}
