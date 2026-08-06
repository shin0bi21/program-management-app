import { getPrograms } from '../api/programs.api';
import type { Program } from '../types/program';
import useListQuery from './useListQuery';

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
