import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getProgramCycles } from '../../../../Programming/Cohorts/cohorts.api';
import { getHoursReferenceData } from '../../hours.api';

export default function useHoursData(
  referenceDataQueryKey: readonly unknown[],
  cyclesQueryKey: readonly unknown[],
  currentUserId?: string,
) {
  const referenceDataQuery = useQuery({
    queryKey: referenceDataQueryKey,
    queryFn: ({ signal }) => getHoursReferenceData({ signal }),
  });
  const cyclesQuery = useQuery({
    queryKey: cyclesQueryKey,
    queryFn: ({ signal }) => getProgramCycles({ signal }),
  });

  const resources = referenceDataQuery.data?.resources;
  const writableResources = useMemo(
    () => resources?.filter(resource => resource.writable) ?? [],
    [resources],
  );
  const resourcesById = useMemo(
    () => new Map(resources?.map(resource => [resource.id, resource]) ?? []),
    [resources],
  );

  return {
    resources: resources ?? [],
    writableResources,
    resourcesById,
    programs: referenceDataQuery.data?.programs ?? [],
    categories: referenceDataQuery.data?.categories ?? [],
    types: referenceDataQuery.data?.types ?? [],
    currentUserResource: currentUserId ? resourcesById.get(currentUserId) ?? null : null,
    optionsLoading: referenceDataQuery.isLoading,
    optionsError: referenceDataQuery.error,
    cycles: cyclesQuery.data ?? [],
    cyclesLoading: cyclesQuery.isLoading,
    cyclesError: cyclesQuery.error,
  };
}
