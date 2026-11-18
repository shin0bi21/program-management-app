import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { getProgramList, type ProgramFilters } from '../../../api/programs.api';
import type { Program } from '../../../types';

/**
 * Loads complete program table rows for the supplied scope.
 * @param queryKey - Program list-only key prefix.
 * @param filters - Assigned-program scope applied by the page.
 * @example useProgramTableData(['programs', 'table'], filters).rows
 */
export default function useProgramTableData(
  queryKey: readonly unknown[],
  filters: ProgramFilters,
) {
  const query = useInfiniteListQuery<Program>({
    ordering: { getValue: program => program.title.toLowerCase(), direction: 'asc' },
    queryKey: [...queryKey, filters],
    queryFn: ({ signal, pageParam }) => getProgramList(
      filters,
      { key: 'title', direction: 'asc', cursor: pageParam ?? undefined },
      { signal },
    ),
    errorMessage: 'Could not load programs',
  });

  return query;
}
