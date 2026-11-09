import { useState } from 'react';

import { setProgramCycle, type SetCycleResult } from '../../../api/cycles.api';
import type { ProgramCycleAssignment } from '../../../types';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import { getErrorMessage } from '../../../../../../http/errors';

interface CycleInput {
  name: string;
  startsOn: string;
  endsOn: string;
}

interface UseCycleModalOptions {
  cycle: ProgramCycle | null;
  assignments: ProgramCycleAssignment[];
  programsReady?: boolean;
  onSaved: (result: SetCycleResult, operation: 'create' | 'update') => void | Promise<void>;
}

/**
 * Saves one mounted cycle editor with its supplied program assignments.
 * @param options - Saved cycle, loaded assignments, selectable-program readiness, and save callback.
 * @example useCycleModal({ cycle, assignments, onSaved }).selectedProgramIds
 */
export default function useCycleModal({ cycle, assignments, programsReady = true, onSaved }: UseCycleModalOptions) {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>(() =>
    assignments.filter(assignment => assignment.cycleId === cycle?.id).map(assignment => assignment.programId),
  );
  const { tryLock, unlock } = useSubmitLock();

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const assignmentsReady = programsReady;
  const toggleProgram = (programId: string) => {
    if (submissionComplete || !assignmentsReady) return;
    setSelectedProgramIds(current => current.includes(programId)
      ? current.filter(id => id !== programId)
      : [...current, programId]);
  };

  const submit = async (input: CycleInput) => {
    if (!assignmentsReady || !tryLock()) return;

    setSubmitStatus('submitting');
    setStatusMessage(cycle ? `Updating ${input.name}...` : `Creating ${input.name}...`);

    try {
      const command = { ...input, programIds: selectedProgramIds };
      const saved = cycle ? await setProgramCycle(command, cycle.id) : await setProgramCycle(command);
      await onSaved(saved, cycle ? 'update' : 'create');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not save cycle'));
      setSubmitStatus('error');
      unlock();
      return;
    }

    setStatusMessage(cycle ? 'Cycle updated successfully.' : 'Cycle created successfully.');
    setSubmitStatus('success');
  };

  return {
    submitStatus,
    statusMessage: statusMessage || undefined,
    submissionComplete,
    selectedProgramIds,
    assignmentsReady,
    toggleProgram,
    submit,
  };
}
