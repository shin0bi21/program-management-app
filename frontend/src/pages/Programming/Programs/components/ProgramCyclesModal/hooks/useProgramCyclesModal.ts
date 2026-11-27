import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';

import { setProgramCycles } from '../../../api/programs.api';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';
import type { ProgramCycleAssignment } from '../../../types';
import { syncProgramCycleAssignmentChanges } from '../../../hooks/actions/programCycleAssignmentCache';

/**
 * Edits assigned cycles for the program draft owned by this keyed modal instance.
 * @param programId - Program whose supplied assignments are edited.
 * @param assignments - Loaded program-cycle rows supplied by the opening page.
 * @param cyclesReady - Whether selectable cycle reference data is available.
 * @example useProgramCyclesModal('program-1', assignments, true) // one program's assigned-cycle draft
 */
export default function useProgramCyclesModal(programId: string, assignments: ProgramCycleAssignment[], cyclesReady: boolean) {
  const queryClient = useQueryClient();
  const { watch, getValues, setValue, handleSubmit } = useForm({
    defaultValues: { selectedCycleIds: assignments.filter(assignment => assignment.programId === programId).map(assignment => assignment.cycleId) },
  });
  const selectedCycleIds = watch('selectedCycleIds');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  const locked = submitStatus === 'submitting' || submitStatus === 'success';
  const ready = cyclesReady;

  const toggleCycle = (cycleId: string) => {
    if (locked || !ready) return;
    const ids = getValues('selectedCycleIds');
    setValue('selectedCycleIds', ids.includes(cycleId) ? ids.filter(id => id !== cycleId) : [...ids, cycleId]);
  };

  const submit = handleSubmit(async ({ selectedCycleIds }) => {
    if (!ready || !tryLock()) return;

    setSubmitStatus('submitting');
    setStatusMessage('Saving assigned cycles...');

    try {
      const saved = await setProgramCycles(programId, selectedCycleIds);

      syncProgramCycleAssignmentChanges(queryClient, saved);

      setSubmitStatus('success');
      setStatusMessage('Assigned cycles saved.');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not save assigned cycles'));
      setSubmitStatus('error');
      unlock();
    }
  });

  return {
    selectedCycleIds,
    locked,
    ready,
    submitStatus,
    statusMessage: statusMessage || undefined,
    toggleCycle,
    submit,
  };
}
