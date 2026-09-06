import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { getCohortPage } from '../../../cohorts.api';
import type { CohortListFilters, CohortSortKey, ProgramCohort } from '../../../types';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';

export default function useCohortTableData(
  queryKey: readonly unknown[],
  filters: CohortListFilters | null,
  sorting: ListSort<CohortSortKey>,
) {
  return useInfiniteListQuery<ProgramCohort>({
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => {
      if (filters === null) throw new Error('Cohort table filters are not initialized');
      return getCohortPage(filters, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }, { signal });
    },
    errorMessage: 'Could not load cohorts',
    enabled: filters !== null,
  });
}
