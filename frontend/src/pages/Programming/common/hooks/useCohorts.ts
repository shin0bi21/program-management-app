import { getCohorts } from '../../../../common/features/programming/api/programming.api';
import type { ProgramCohort } from '../../../../common/types/cohort';
import useListQuery from '../../../../query/hooks/useListQuery';
import { COHORT_OPTIONS_QUERY_KEY } from '../queryKeys';

export function useCohorts(programId?: string, enabled = true) {
  const query = useListQuery<ProgramCohort>({
    queryKey: [...COHORT_OPTIONS_QUERY_KEY, { programId }],
    queryFn: ({ signal }) => getCohorts(programId, {}, { signal }),
    errorMessage: 'Could not load cohorts',
    enabled,
  });

  return { cohorts: query.rows, loading: query.loading, error: query.error, refresh: query.refetch };
}
