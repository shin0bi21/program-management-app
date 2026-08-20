import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getProgramCycles } from '../../../../common/features/programming/api/cohorts.api';
import { getTimeEntryOptions } from '../../../../common/features/timeEntries/timeEntries.api';

export default function useHoursData(
  optionsQueryKey: readonly unknown[],
  cyclesQueryKey: readonly unknown[],
  currentUserId?: string,
) {
  const optionsData = useQuery({
    queryKey: optionsQueryKey,
    queryFn: ({ signal }) => getTimeEntryOptions({ signal }),
  });
  const cyclesData = useQuery({
    queryKey: cyclesQueryKey,
    queryFn: ({ signal }) => getProgramCycles({ signal }),
  });

  const resources = optionsData.data?.resources;
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
    programs: optionsData.data?.programs ?? [],
    currentUserResource: currentUserId ? resourcesById.get(currentUserId) ?? null : null,
    optionsLoading: optionsData.isLoading,
    optionsError: optionsData.error,
    cycles: cyclesData.data ?? [],
    cyclesLoading: cyclesData.isLoading,
    cyclesError: cyclesData.error,
  };
}
