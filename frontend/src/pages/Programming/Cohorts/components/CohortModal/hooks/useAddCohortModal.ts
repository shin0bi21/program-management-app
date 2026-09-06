import { type FormEvent, useEffect, useState } from 'react';

import { createCohort } from '../../../cohorts.api';
import type { Program } from '../../../../../../common/features/programs/types';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { ProgramCycle } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';

interface UseAddCohortModalOptions {
  isOpen: boolean;
  programs: Program[];
  cycles: ProgramCycle[];
  initialProgramId: string;
  onCreated: () => void | Promise<void>;
}

export function useAddCohortModal({
  isOpen,
  programs,
  cycles,
  initialProgramId,
  onCreated,
}: UseAddCohortModalOptions) {
  const [programId, setProgramId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  useEffect(() => {
    if (!isOpen) return;

    setProgramId(initialProgramId || programs[0]?.id || '');
    setCycleId(cycles.find(cycle => cycle.state === 'active')?.id ?? cycles[0]?.id ?? '');
    setStatus('idle');
    setStatusMessage('');
    unlock();
  }, [cycles, initialProgramId, isOpen, programs, unlock]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tryLock()) return;

    const cycleName = cycles.find(cycle => cycle.id === cycleId)?.name ?? 'cycle';
    const programName = programs.find(program => program.id === programId)?.name ?? 'program';
    setStatus('submitting');
    setStatusMessage(`Adding ${programName} to ${cycleName}...`);

    try {
      await createCohort({ programId, cycleId });
      await onCreated();
      setStatusMessage(`${programName} successfully added to ${cycleName}.`);
      setStatus('success');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not create cohort'));
      setStatus('error');
      unlock();
    }
  };

  return {
    programId,
    setProgramId,
    cycleId,
    setCycleId,
    status,
    statusMessage,
    submissionComplete: status === 'submitting' || status === 'success',
    submit,
  };
}
