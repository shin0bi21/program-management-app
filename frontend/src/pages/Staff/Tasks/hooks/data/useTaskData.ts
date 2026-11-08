import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useCycleReferences, useProgramReferences, useStaffReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { getTaskReferenceData } from '../../tasks.api';

/**
 * Supplies shared staff, program, cycle, and task choices.
 * @param referenceDataQueryKey - Cache key for task categories and lifecycle statuses.
 * @example const { resources, cycles } = useTaskData(['task-reference-data'])
 */
export default function useTaskData(referenceDataQueryKey: readonly unknown[]) {
  const query = useQuery({
    queryKey: referenceDataQueryKey,
    queryFn: ({ signal }) => getTaskReferenceData({ signal }),
  });

  const cyclesQuery = useCycleReferences();
  const programsQuery = useProgramReferences();
  const staffQuery = useStaffReferences('tasks');
  const resources = staffQuery.rows;

  const writableResources = useMemo(
    () => resources?.filter(resource => resource.writable) ?? [],
    [resources],
  );

  return {
    cycles: cyclesQuery.rows,
    cyclesLoading: cyclesQuery.loading,
    cyclesError: cyclesQuery.error,
    referenceData: query.data,
    referenceDataLoading: query.isLoading,
    referenceDataError: query.error,
    resources,
    resourcesLoading: staffQuery.loading,
    resourcesError: staffQuery.error,
    programs: programsQuery.rows,
    programsLoading: programsQuery.loading,
    programsError: programsQuery.error,
    writableResources,
  };
}
