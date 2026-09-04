import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getTaskReferenceData } from '../../tasks.api';

export default function useTaskData(referenceDataQueryKey: readonly unknown[]) {
  const query = useQuery({
    queryKey: referenceDataQueryKey,
    queryFn: ({ signal }) => getTaskReferenceData({ signal }),
  });

  const resources = query.data?.resources;

  const writableResources = useMemo(
    () => resources?.filter(resource => resource.writable) ?? [],
    [resources],
  );

  return {
    referenceData: query.data,
    referenceDataLoading: query.isLoading,
    referenceDataError: query.error,
    resources: resources ?? [],
    writableResources,
  };
}
