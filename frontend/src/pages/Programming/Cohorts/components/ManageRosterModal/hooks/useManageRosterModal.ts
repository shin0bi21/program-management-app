import { useEffect, useState } from 'react';

import type { ConfirmAction } from '../../../../../../common/components/ConfirmModal/types';
import { withdrawYouth } from '../../../../../../common/features/programming/api/cohorts.api';
import type { ProgramCohort } from '../../../../../../common/types/cohort';
import type { YouthProfile } from '../../../../../../common/types/youth';

interface UseManageRosterModalOptions {
  cohort: ProgramCohort | null;
  refresh: () => Promise<void>;
  onSuccess: () => void | Promise<void>;
}

export function useManageRosterModal({ cohort, refresh, onSuccess }: UseManageRosterModalOptions) {
  const [addingYouth, setAddingYouth] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [refreshError, setRefreshError] = useState('');
  const cohortId = cohort?.id;

  useEffect(() => {
    setAddingYouth(false);
    setConfirmAction(null);
    setRefreshError('');
  }, [cohortId]);

  const requestWithdrawal = (profile: YouthProfile) => {
    if (!cohort) return;

    setRefreshError('');
    setConfirmAction({
      title: 'Withdraw Youth',
      message: `Withdraw ${profile.firstName} ${profile.lastName} from ${cohort.programName} - ${cohort.name}? Their existing attendance history will be kept.`,
      confirmLabel: 'Withdraw',
      confirmVariant: 'danger',
      successMessage: `${profile.firstName} ${profile.lastName} successfully withdrawn.`,
      onConfirm: async () => {
        await withdrawYouth(cohort.id, profile.id);

        try {
          await Promise.all([refresh(), onSuccess()]);
        } catch {
          setRefreshError('Youth was withdrawn, but the roster could not refresh. Reload to see it.');
        }
      },
    });
  };

  const enrollmentSucceeded = async () => {
    await refresh();
    await onSuccess();
  };

  return {
    addingYouth,
    openEnrollment: () => setAddingYouth(true),
    closeEnrollment: () => setAddingYouth(false),
    enrollmentSucceeded,
    confirmAction,
    requestWithdrawal,
    closeConfirmation: () => setConfirmAction(null),
    refreshError,
  };
}
