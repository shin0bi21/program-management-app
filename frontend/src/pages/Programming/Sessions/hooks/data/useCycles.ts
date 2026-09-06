import { getProgramCycles } from '../../../Cohorts/cohorts.api';
import type { ProgramCycle } from '../../../Cohorts/types';
import useListQuery from '../../../../../query/hooks/useListQuery';

export function useCycles() {
  const query = useListQuery<ProgramCycle>({
    queryKey: ['program-cycles'],
    queryFn: ({ signal }) => getProgramCycles({ signal }),
    errorMessage: 'Could not load cycles',
  });

  return { cycles: query.rows, loading: query.loading, error: query.error };
}
