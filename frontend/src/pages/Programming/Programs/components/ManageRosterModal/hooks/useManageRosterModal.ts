import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { syncProgramCycleAssignmentChanges } from '../../../hooks/actions/programCycleAssignmentCache';

import type { ConfirmAction } from '../../../../../../common/components/ConfirmModal/types';
import { enrollYouth, withdrawYouth, type RosterMutationResult } from '../../../api/programCycleAssignments.api';
import type { ProgramRosterYouth } from '../../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';

interface UseManageRosterModalOptions {
  assignment: ProgramCycleAssignment | null;
  refresh: () => Promise<void>;
  onSuccess: (result: RosterMutationResult) => void | Promise<void>;
}

export function useManageRosterModal({ assignment, refresh, onSuccess }: UseManageRosterModalOptions) {
  const queryClient = useQueryClient();
  const { tryLock, unlock } = useSubmitLock();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [pendingYouthId, setPendingYouthId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const programId = assignment?.programId;
  const cycleId = assignment?.cycleId;

  useEffect(() => {
    setConfirmAction(null);
    setPendingYouthId(null);
    setActionError('');
    unlock();
  }, [programId, cycleId, unlock]);

  const reconcileRoster = async (completedAction: string, result: RosterMutationResult) => {
    syncProgramCycleAssignmentChanges(queryClient, { updatedProgramCycles: [result.programCycle], updatedYouth: result.updatedYouth, createdProgramCycles: [], removedProgramCycles: [] });

    try {
      await Promise.all([refresh(), onSuccess(result)]);
    } catch {
      setActionError(`${completedAction}, but the roster could not refresh. Reload to see the change.`);
    }
  };

  const addYouth = async (profile: ProgramRosterYouth) => {
    if (!assignment || !tryLock()) return;

    setPendingYouthId(profile.id);
    setActionError('');
    let saved: RosterMutationResult;
    try {
      saved = await enrollYouth(assignment, { youthIds: [profile.id] });
    } catch (cause) {
      setActionError(getErrorMessage(cause, 'Could not enroll youth'));
      setPendingYouthId(null);
      unlock();
      return;
    }

    await reconcileRoster(`${profile.firstName} ${profile.lastName} was enrolled`, saved);
    setPendingYouthId(null);
    unlock();
  };

  const requestWithdrawal = (profile: ProgramRosterYouth) => {
    if (!assignment) return;

    setActionError('');
    setConfirmAction({
      title: 'Withdraw Youth',
      message: `Withdraw ${profile.firstName} ${profile.lastName} from ${assignment.program} - ${assignment.cycle}? Their existing attendance history will be kept.`,
      confirmVariant: 'danger',
      successMessage: `${profile.firstName} ${profile.lastName} successfully withdrawn.`,
      onConfirm: async () => {
        const saved = await withdrawYouth(assignment, profile.id);

        await reconcileRoster(`${profile.firstName} ${profile.lastName} was withdrawn`, saved);
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
