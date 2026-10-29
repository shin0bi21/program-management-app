import { useEffect, useRef, useState } from 'react';

import { setProgramCycle, type SetCycleResult } from '../../../api/cycles.api';
import type { Program } from '../../../../../../common/features/programs/types';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import { getErrorMessage } from '../../../../../../http/errors';
import { getCohorts } from '../../../../Cohorts/cohorts.api';

interface CycleInput {
  name: string;
  startsOn: string;
  endsOn: string;
}

interface UseCycleModalOptions {
  isOpen: boolean;
  cycle: ProgramCycle | null;
  programs: Program[];
  programsReady?: boolean;
  onSaved: (result: SetCycleResult, operation: 'create' | 'update') => void | Promise<void>;
}

export default function useCycleModal({ isOpen, cycle, programs, programsReady = true, onSaved }: UseCycleModalOptions) {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[] | null>(null);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const { tryLock, unlock } = useSubmitLock();
  const lifecycle = useRef<object>({});
  const targetKey = isOpen ? cycle?.id ?? 'new' : 'closed';
  const programsRef = useRef(programs);
  programsRef.current = programs;

  useEffect(() => {
    const currentLifecycle = {};
    lifecycle.current = currentLifecycle;
    setSubmitStatus('idle');
    setStatusMessage('');
    setSelectedProgramIds(null);
    setAssignmentsError(null);
    unlock();
    if (!isOpen || !programsReady) return () => { lifecycle.current = {}; };

    if (!cycle) {
      setSelectedProgramIds(programsRef.current.map(program => program.id));
      return () => { lifecycle.current = {}; };
    }

    const controller = new AbortController();
    void getCohorts(undefined, { includeAllPrograms: true }, { signal: controller.signal })
      .then(cohorts => {
        if (controller.signal.aborted) return;
        setSelectedProgramIds(cohorts.filter(cohort => cohort.cycleId === cycle.id).map(cohort => cohort.programId));
      })
      .catch(cause => {
        if (controller.signal.aborted) return;
        setAssignmentsError(getErrorMessage(cause, 'Could not load assigned programs'));
      });

    return () => { controller.abort(); lifecycle.current = {}; };
  }, [targetKey, isOpen, cycle?.id, programsReady, loadRevision, unlock]);

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const assignmentsReady = programsReady && selectedProgramIds !== null && !assignmentsError;
  const toggleProgram = (programId: string) => {
    if (submissionComplete || !assignmentsReady) return;
    setSelectedProgramIds(current => current && (current.includes(programId)
      ? current.filter(id => id !== programId)
      : [...current, programId]));
  };

  const submit = async (input: CycleInput) => {
    if (!assignmentsReady || selectedProgramIds === null || !tryLock()) return;

    const submittedLifecycle = lifecycle.current;
    const isCurrent = () => lifecycle.current === submittedLifecycle;
    setSubmitStatus('submitting');
    setStatusMessage(cycle ? `Updating ${input.name}...` : `Creating ${input.name}...`);

    try {
      const command = { ...input, programIds: selectedProgramIds };
      const saved = cycle ? await setProgramCycle(command, cycle.id) : await setProgramCycle(command);
      await onSaved(saved, cycle ? 'update' : 'create');
    } catch (cause) {
      if (!isCurrent()) return;
      setStatusMessage(getErrorMessage(cause, 'Could not save cycle'));
      setSubmitStatus('error');
      unlock();
      return;
    }

    if (!isCurrent()) return;
    setStatusMessage(cycle ? 'Cycle updated successfully.' : 'Cycle created successfully.');
    setSubmitStatus('success');
  };

  return {
    submitStatus,
    statusMessage: statusMessage || undefined,
    submissionComplete,
    selectedProgramIds,
    assignmentsReady,
    assignmentsError,
    retryAssignments: () => setLoadRevision(current => current + 1),
    toggleProgram,
    submit,
  };
}
