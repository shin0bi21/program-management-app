import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { getProgramList, type ProgramFilters } from '../../../api/programs.api';
import type { Program } from '../../../../../../common/features/programs/types';

export default function useProgramTableData(queryKey: readonly unknown[], filters: ProgramFilters) {
  return useInfiniteListQuery<Program>({
    ordering: { getValue: program => program.name.toLowerCase(), direction: 'asc' },
    queryKey: [...queryKey, filters],
    queryFn: ({ signal, pageParam }) => getProgramList(
      filters,
      { key: 'name', direction: 'asc', limit: TABLE_PAGE_SIZE, cursor: pageParam ?? undefined },
      { signal },
    ),
    errorMessage: 'Could not load programs',
  });
}
