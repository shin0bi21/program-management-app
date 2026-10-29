import { getCohorts } from '../../../Cohorts/cohorts.api';
import type { ProgramCohort } from '../../../Cohorts/types';
import useListQuery from '../../../../../query/hooks/useListQuery';

const COHORT_OPTIONS_QUERY_KEY = ['cohorts', 'options'] as const;

export function useCohorts(programId?: string, enabled = true) {
  const query = useListQuery<ProgramCohort>({
    queryKey: [...COHORT_OPTIONS_QUERY_KEY, { programId }],
    queryFn: ({ signal }) => getCohorts(programId, {}, { signal }),
    errorMessage: 'Could not load cohorts',
    enabled,
  });

  return { cohorts: query.rows, loading: query.loading, error: query.error, refresh: query.refetch };
}
