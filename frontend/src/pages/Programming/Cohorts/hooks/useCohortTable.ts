import useInfiniteListQuery from '../../../../query/hooks/useInfiniteListQuery';
import { getCohortPage } from '../../../../common/features/programming/api/programming.api';
import type { CohortSortKey, ProgramCohort } from '../../../../common/types/cohort';
import type { ListSort } from '../../../../common/types/pagination';
import { COHORT_TABLE_QUERY_KEY } from '../../common/queryKeys';

export default function useCohortTable(filters: { programId?: string; search?: string; status?: string } | null, sorting: ListSort<CohortSortKey>) {
  return useInfiniteListQuery<ProgramCohort>({
    queryKey: [...COHORT_TABLE_QUERY_KEY, filters, sorting],
    queryFn: ({ signal, pageParam }) => getCohortPage(filters ?? {}, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }, { signal }),
    errorMessage: 'Could not load cohorts',
    enabled: filters !== null,
  });
}
