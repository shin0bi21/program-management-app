import { useEffect, useState } from 'react';

import { setProgramCycle } from '../../../../../../common/features/programming/cycles/cycles.api';
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
  isOpen: boolean;
  cycle: ProgramCycle | null;
  onSaved: () => void | Promise<void>;
}

export default function useCycleModal({ isOpen, cycle, onSaved }: UseCycleModalOptions) {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  useEffect(() => {
    if (!isOpen) return;
    setSubmitStatus('idle');
    setStatusMessage('');
    unlock();
  }, [cycle, isOpen, unlock]);

  const submit = async (input: CycleInput) => {
    if (!tryLock()) return;

    setSubmitStatus('submitting');
    setStatusMessage(cycle ? `Updating ${input.name}...` : `Creating ${input.name}...`);

    try {
      if (cycle) await setProgramCycle(input, cycle.id);
      else await setProgramCycle(input);
      await onSaved();
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
    submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    submit,
  };
}
