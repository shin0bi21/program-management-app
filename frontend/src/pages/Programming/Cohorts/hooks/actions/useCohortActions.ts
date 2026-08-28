import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import { deleteCohort } from '../../../../../common/features/programming/api/cohorts.api';
import { COHORT_OPTIONS_QUERY_KEY, SESSION_QUERY_KEY } from '../../../../../common/features/programming/queryKeys';
import { YOUTH_QUERY_KEY } from '../../../../../common/features/youth/queryKeys';
import type { ProgramCohort } from '../../../../../common/types/cohort';
import { removeInfiniteListRow } from '../../../../../query/infiniteListCache';

export default function useCohortActions({
  tableQueryKey,
  onCohortRemoved,
}: {
  tableQueryKey: readonly unknown[];
  onCohortRemoved: (cohortId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const refreshCohorts = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tableQueryKey }),
      queryClient.invalidateQueries({ queryKey: COHORT_OPTIONS_QUERY_KEY }),
    ]);
  }, [queryClient, tableQueryKey]);

  const refreshRoster = useCallback(async () => {
    await Promise.all([
      refreshCohorts(),
      queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
    ]);
  }, [queryClient, refreshCohorts]);

  const refreshGeneratedSessions = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
      refreshCohorts(),
    ]);
  }, [queryClient, refreshCohorts]);

  const requestDelete = useCallback((cohort: ProgramCohort) => setConfirmAction({
    title: 'Delete Cohort',
    message: `Delete ${cohort.programName} · ${cohort.name}? Its sessions and enrollments will also be deleted. Cohorts with attendance cannot be deleted.`,
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
    refreshCohorts,
    refreshRoster,
    refreshGeneratedSessions,
    requestDelete,
    closeConfirmation,
  };
}
