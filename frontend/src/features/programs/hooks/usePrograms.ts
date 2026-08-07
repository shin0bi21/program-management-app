import { getPrograms } from '../api/programs.api';
import type { Program } from '../types';
import useListQuery from '../../../common/query/hooks/useListQuery';

export function usePrograms({ assignedOnly = false }: { assignedOnly?: boolean } = {}) {
  const query = useListQuery<Program>({
    queryKey: ['programs', { assignedOnly }],
    queryFn: ({ signal }) => getPrograms({ assignedOnly }, { signal }),
    errorMessage: 'Failed to load programs',
  });

  return {
    programs: query.rows,
    upsertProgram: query.upsert,
    loading: query.loading,
    error: query.error,
  };
}
