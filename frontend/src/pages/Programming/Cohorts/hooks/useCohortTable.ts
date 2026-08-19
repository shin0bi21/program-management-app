import useInfiniteListQuery from '../../../../query/hooks/useInfiniteListQuery';
import { getCohortPage } from '../../../../common/features/programming/api/cohorts.api';
import type { CohortSortKey, ProgramCohort } from '../../../../common/types/cohort';
import type { ListSort } from '../../../../common/types/pagination';

export default function useCohortTable(
  queryKey: readonly unknown[],
  filters: { programId?: string; search?: string; status?: string } | null,
  sorting: ListSort<CohortSortKey>,
) {
  return useInfiniteListQuery<ProgramCohort>({
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => getCohortPage(filters ?? {}, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }, { signal }),
    errorMessage: 'Could not load cohorts',
    enabled: filters !== null,
  });
}
