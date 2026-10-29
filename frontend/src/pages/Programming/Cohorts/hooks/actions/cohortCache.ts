import type { QueryClient } from '@tanstack/react-query';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../../query/infiniteListCache';
import type { CohortChanges } from '../../cohorts.api';

export const COHORT_TABLE_QUERY_KEY = ['cohorts', 'table'] as const;

export function syncCohortChanges(queryClient: QueryClient, changes: CohortChanges) {
  for (const cohort of changes.updatedCohorts) {
    replaceInfiniteListRow(queryClient, COHORT_TABLE_QUERY_KEY, cohort);
  }
  for (const id of changes.removedCohortIds) {
    removeInfiniteListRow(queryClient, COHORT_TABLE_QUERY_KEY, id);
  }
  for (const youth of changes.updatedYouth ?? []) {
    replaceInfiniteListRow(queryClient, ['youth', 'table'], youth);
  }
  if (changes.createdCohortIds.length) {
    void queryClient.invalidateQueries({ queryKey: COHORT_TABLE_QUERY_KEY });
  }

  void queryClient.invalidateQueries({ queryKey: ['cohorts', 'options'] });
  void queryClient.invalidateQueries({ queryKey: ['cohorts', 'program-cycle-assignments'] });
}
