import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { setProgramCycle, type SetCycleResult } from '../../../api/cycles.api';
import type { ProgramCycleAssignment } from '../../../types';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import { getErrorMessage } from '../../../../../../http/errors';

interface CycleFields {
  title: string;
  startsOn: string;
  endsOn: string;
  selectedProgramIds: string[];
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
  const { register, watch, getValues, setValue, handleSubmit } = useForm<CycleFields>({
    defaultValues: {
      title: cycle?.title ?? '',
      startsOn: cycle?.startsOn ?? '',
      endsOn: cycle?.endsOn ?? '',
      selectedProgramIds: assignments.filter(assignment => assignment.cycleId === cycle?.id).map(assignment => assignment.programId),
    },
  });
  const selectedProgramIds = watch('selectedProgramIds');
  const { tryLock, unlock } = useSubmitLock();

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const assignmentsReady = programsReady;
  const toggleProgram = (programId: string) => {
    if (submissionComplete || !assignmentsReady) return;
    const ids = getValues('selectedProgramIds');
    setValue('selectedProgramIds', ids.includes(programId) ? ids.filter(id => id !== programId) : [...ids, programId]);
  };

  const submit = handleSubmit(async ({ selectedProgramIds, ...input }) => {
    if (!assignmentsReady || !tryLock()) return;

    setSubmitStatus('submitting');
    setStatusMessage(cycle ? `Updating ${input.title}...` : `Creating ${input.title}...`);

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
  });

  return {
    register,
    submitStatus,
    statusMessage: statusMessage || undefined,
    submissionComplete,
    selectedProgramIds,
    assignmentsReady,
    toggleProgram,
    setValue,
    submit,
  };
}
