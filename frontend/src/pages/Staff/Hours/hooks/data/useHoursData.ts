import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useCycleReferences, useProgramReferences, useStaffReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { getHoursReferenceData } from '../../hours.api';

export default function useHoursData(
  referenceDataQueryKey: readonly unknown[],
  currentUserId?: string,
) {
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
