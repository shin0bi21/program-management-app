import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
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
    ordering: {
      direction: sorting.direction,
      getValue: cohort => ({
        program: cohort.programName.toLowerCase(), cohort: cohort.name.toLowerCase(),
        start: cohort.startsOn, end: cohort.endsOn, status: cohort.state,
      }[sorting.key]),
    },
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => {
      if (filters === null) throw new Error('Cohort table filters are not initialized');
      return getCohortPage(filters, { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE }, { signal });
    },
    errorMessage: 'Could not load cohorts',
    enabled: filters !== null,
  });
}
