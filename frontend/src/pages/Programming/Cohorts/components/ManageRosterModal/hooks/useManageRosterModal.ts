import { useEffect, useState } from 'react';

import type { ConfirmAction } from '../../../../../../common/components/ConfirmModal/types';
import { enrollYouth, withdrawYouth } from '../../../cohorts.api';
import type { CohortRosterYouth, ProgramCohort } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';

interface UseManageRosterModalOptions {
  cohort: ProgramCohort | null;
  refresh: () => Promise<void>;
  onSuccess: () => void | Promise<void>;
}

export function useManageRosterModal({ cohort, refresh, onSuccess }: UseManageRosterModalOptions) {
  const { tryLock, unlock } = useSubmitLock();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [pendingYouthId, setPendingYouthId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const cohortId = cohort?.id;

  useEffect(() => {
    setConfirmAction(null);
    setPendingYouthId(null);
    setActionError('');
    unlock();
  }, [cohortId, unlock]);

  const reconcileRoster = async (completedAction: string) => {
    try {
      await Promise.all([refresh(), onSuccess()]);
    } catch {
      setActionError(`${completedAction}, but the roster could not refresh. Reload to see the change.`);
    }
  };

  const addYouth = async (profile: CohortRosterYouth) => {
    if (!cohort || !tryLock()) return;

    setPendingYouthId(profile.id);
    setActionError('');
    try {
      await enrollYouth(cohort.id, { youthIds: [profile.id] });
    } catch (cause) {
      setActionError(getErrorMessage(cause, 'Could not enroll youth'));
      setPendingYouthId(null);
      unlock();
      return;
    }

    await reconcileRoster(`${profile.firstName} ${profile.lastName} was enrolled`);
    setPendingYouthId(null);
    unlock();
  };

  const requestWithdrawal = (profile: CohortRosterYouth) => {
    if (!cohort) return;

    setActionError('');
    setConfirmAction({
      title: 'Withdraw Youth',
      message: `Withdraw ${profile.firstName} ${profile.lastName} from ${cohort.programName} - ${cohort.name}? Their existing attendance history will be kept.`,
      confirmLabel: 'Withdraw',
      confirmVariant: 'danger',
      successMessage: `${profile.firstName} ${profile.lastName} successfully withdrawn.`,
      onConfirm: async () => {
        await withdrawYouth(cohort.id, profile.id);

        await reconcileRoster(`${profile.firstName} ${profile.lastName} was withdrawn`);
      },
    });
  };

  return {
    pendingYouthId,
    addYouth,
    confirmAction,
    requestWithdrawal,
    closeConfirmation: () => setConfirmAction(null),
    actionError,
  };
}
