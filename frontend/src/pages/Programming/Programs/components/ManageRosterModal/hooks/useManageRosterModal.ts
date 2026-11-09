import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { syncProgramCycleAssignmentChanges } from '../../../hooks/actions/programCycleAssignmentCache';

import type { ConfirmAction } from '../../../../../../common/components/ConfirmModal/types';
import { enrollYouth, withdrawYouth, type RosterMutationResult } from '../../../api/programCycleAssignments.api';
import type { ProgramRosterYouth } from '../../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';

interface UseManageRosterModalOptions {
  assignment: ProgramCycleAssignment;
  refresh: () => Promise<void>;
  onSuccess: (result: RosterMutationResult) => void | Promise<void>;
}

/**
 * Enrolls or withdraws Youth, then refreshes affected queries and roster callbacks.
 * @param options - Selected assignment and callbacks that refresh the roster after a save.
 * @example useManageRosterModal({ assignment, refresh, onSuccess })
 */
export function useManageRosterModal({ assignment, refresh, onSuccess }: UseManageRosterModalOptions) {
  const queryClient = useQueryClient();
  const { tryLock, unlock } = useSubmitLock();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [pendingYouthId, setPendingYouthId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const reconcileRoster = async (completedAction: string, result: RosterMutationResult) => {
    syncProgramCycleAssignmentChanges(queryClient, { updatedProgramCycles: [result.programCycle], updatedYouth: result.updatedYouth, createdProgramCycles: [], removedProgramCycles: [] });

    try {
      await Promise.all([refresh(), onSuccess(result)]);
    } catch {
      setActionError(`${completedAction}, but the roster could not refresh. Reload to see the change.`);
    }
  };

  const addYouth = async (profile: ProgramRosterYouth) => {
    if (!tryLock()) return;

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
