import { getProgramCycles } from '../../../../../common/features/programming/cycles/cycles.api';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
import useListQuery from '../../../../../query/hooks/useListQuery';

export function useCycles() {
  const query = useListQuery<ProgramCycle>({
    queryKey: ['program-cycles'],
    queryFn: ({ signal }) => getProgramCycles({ signal }),
    errorMessage: 'Could not load cycles',
  });

  return { cycles: query.rows, loading: query.loading, error: query.error };
}
