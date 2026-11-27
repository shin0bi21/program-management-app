import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { syncProgramCycleAssignmentChanges } from '../../../hooks/actions/programCycleAssignmentCache';
import { setProgramRoster, type ProgramRosterYouth, type RosterMutationResult } from '../../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';

interface UseManageRosterModalOptions {
  assignment: ProgramCycleAssignment;
  youth: ProgramRosterYouth[];
  refresh: () => Promise<void>;
  onSuccess: (result: RosterMutationResult) => void | Promise<void>;
}

/**
 * Owns a loaded roster draft and saves the complete selection only on form submission.
 * @param options - Assignment, loaded candidates, and callbacks that reconcile a committed save.
 * @example Toggling a selected youth edits selectedYouthIds without sending a request.
 */
export function useManageRosterModal({ assignment, youth, refresh, onSuccess }: UseManageRosterModalOptions) {
  const queryClient = useQueryClient();
  const { tryLock, unlock } = useSubmitLock();
  const { watch, getValues, setValue, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { selectedYouthIds: youth.filter(profile => profile.programCycles.some(
      enrollment => enrollment.programId === assignment.programId && enrollment.cycleId === assignment.cycleId && enrollment.withdrawnOn === null,
    )).map(profile => profile.id) },
  });
  const selectedYouthIds = watch('selectedYouthIds');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const locked = submitStatus === 'submitting' || submitStatus === 'success';

  /**
   * Toggles one candidate in the local draft while editing is available.
   * @param youthId - ID of a candidate supplied to this mounted editor.
   * @example Toggling an enrolled youth removes their ID from the pending payload.
   */
  const toggleYouth = (youthId: string) => {
    if (locked || isSubmitting) return;
    const ids = getValues('selectedYouthIds');
    setValue('selectedYouthIds', ids.includes(youthId) ? ids.filter(id => id !== youthId) : [...ids, youthId]);
  };

  /**
   * Saves the complete roster in one request and reconciles the authoritative response.
   * @example Repeated submissions while saving send only one request.
   */
  const submit = handleSubmit(async ({ selectedYouthIds }) => {
    if (!tryLock()) return;
    setSubmitStatus('submitting');
    setStatusMessage('Saving roster...');

    let saved: RosterMutationResult;
    try {
      saved = await setProgramRoster(assignment, { youthIds: selectedYouthIds });
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not save roster'));
      setSubmitStatus('error');
      unlock();
      return;
    }

    try {
      syncProgramCycleAssignmentChanges(queryClient, { updatedProgramCycles: [saved.programCycle], updatedYouth: saved.updatedYouth, createdProgramCycles: [], removedProgramCycles: [] });
      await Promise.all([refresh(), onSuccess(saved)]);
    } catch {
      setStatusMessage('Roster saved, but it could not refresh. Reload to see the changes.');
      setSubmitStatus('error');
      unlock();
      return;
    }

    setSubmitStatus('success');
    setStatusMessage('Roster saved.');
  });

  return { selectedYouthIds, toggleYouth, submit, submitStatus, statusMessage, locked };
}
