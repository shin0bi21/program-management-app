import { getCohorts } from '../../../../common/api/cohorts.api';
import type { ProgramCohort } from '../../../../common/types/cohort';
import useListQuery from '../../../../common/query/hooks/useListQuery';

export function useCohorts(programId?: string, enabled = true) {
  const query = useListQuery<ProgramCohort>({
    queryKey: ['cohorts', { programId }],
    queryFn: ({ signal }) => getCohorts(programId, {}, { signal }),
    errorMessage: 'Could not load cohorts',
    enabled,
  });

  return { cohorts: query.rows, loading: query.loading, error: query.error, refresh: query.refetch };
}
