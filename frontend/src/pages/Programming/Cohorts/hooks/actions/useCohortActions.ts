import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import { deleteCohort, type CohortMutationResult } from '../../cohorts.api';
import type { ProgramCohort } from '../../types';
import { removeInfiniteListRow } from '../../../../../query/infiniteListCache';

import { syncCohortChanges } from './cohortCache';

const COHORT_OPTIONS_QUERY_KEY = ['cohorts', 'options'] as const;

export default function useCohortActions({
  tableQueryKey,
  onCohortRemoved,
  onCohortSynced,
}: {
  tableQueryKey: readonly unknown[];
  onCohortRemoved: (cohortId: string) => void;
  onCohortSynced: (cohort: ProgramCohort) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const cohortCreated = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tableQueryKey }),
      queryClient.invalidateQueries({ queryKey: COHORT_OPTIONS_QUERY_KEY }),
    ]);
  }, [queryClient, tableQueryKey]);

  const syncCohort = useCallback((result: CohortMutationResult) => {
    syncCohortChanges(queryClient, { updatedCohorts: [result.cohort], updatedYouth: result.updatedYouth, createdCohortIds: [], removedCohortIds: [] });
    onCohortSynced(result.cohort);
  }, [onCohortSynced, queryClient]);

  const requestDelete = useCallback((cohort: ProgramCohort) => setConfirmAction({
    title: 'Delete Cohort',
    message: `Delete ${cohort.programName} · ${cohort.name}? Only unused cohorts can be deleted; cohorts with sessions, enrollments, or logged hours must be kept.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'Cohort deleted',
    onConfirm: async () => {
      await deleteCohort(cohort.id);
      removeInfiniteListRow(queryClient, tableQueryKey, cohort.id);
      onCohortRemoved(cohort.id);
      await queryClient.invalidateQueries({ queryKey: COHORT_OPTIONS_QUERY_KEY });
    },
  }), [onCohortRemoved, queryClient, tableQueryKey]);

  const closeConfirmation = useCallback(() => setConfirmAction(null), []);

  return {
    confirmAction,
    cohortCreated,
    syncCohort,
    requestDelete,
    closeConfirmation,
  };
}
