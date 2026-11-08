import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { getProgramList, type ProgramFilters } from '../../../api/programs.api';
import type { Program } from '../../../../../../common/features/programs/types';
import { useProgramCycleAssignments } from '../../../hooks/data/useProgramCycleAssignments';

/**
 * Loads complete program table rows and their assignment status.
 * @param queryKey - Program list-only key prefix.
 * @param filters - Assigned-program scope applied by the page.
 * @example useProgramTableData(['programs', 'table'], filters).rows
 */
export default function useProgramTableData(
  queryKey: readonly unknown[],
  filters: ProgramFilters,
) {
  const assignments = useProgramCycleAssignments();
  const query = useInfiniteListQuery<Program>({
    ordering: { getValue: program => program.name.toLowerCase(), direction: 'asc' },
    queryKey: [...queryKey, filters],
    queryFn: ({ signal, pageParam }) => getProgramList(
      filters,
      { key: 'name', direction: 'asc', limit: TABLE_PAGE_SIZE, cursor: pageParam ?? undefined },
      { signal },
    ),
    errorMessage: 'Could not load programs',
  });

  return { ...query, assignments };
}
