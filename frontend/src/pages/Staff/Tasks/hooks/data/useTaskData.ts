import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getTaskReferenceData } from '../../tasks.api';

export default function useTaskData(referenceDataQueryKey: readonly unknown[]) {
  const referenceDataQuery = useQuery({
    queryKey: referenceDataQueryKey,
    queryFn: ({ signal }) => getTaskReferenceData({ signal }),
  });

  const resources = referenceDataQuery.data?.resources;

  const writableResources = useMemo(
    () => resources?.filter(resource => resource.writable) ?? [],
    [resources],
  );

  return {
    referenceData: referenceDataQuery.data,
    referenceDataLoading: referenceDataQuery.isLoading,
    referenceDataError: referenceDataQuery.error,
    resources: resources ?? [],
    writableResources,
  };
}
