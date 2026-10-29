import { type FormEvent, useEffect, useState } from 'react';

import { updateCohort, type CohortMutationResult } from '../../../cohorts.api';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { ProgramCohort } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';

interface UseEditCohortModalOptions {
  cohort: ProgramCohort | null;
  onUpdated: (result: CohortMutationResult) => void | Promise<void>;
}

export function useEditCohortModal({ cohort, onUpdated }: UseEditCohortModalOptions) {
  const [cycleId, setCycleId] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  useEffect(() => {
    if (!cohort) return;

    setCycleId(cohort.cycleId);
    setStatus('idle');
    setStatusMessage('');
    unlock();
  }, [cohort, unlock]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cohort || !tryLock()) return;

    setStatus('submitting');
    setStatusMessage('Updating cohort...');

    try {
      const saved = await updateCohort(cohort.id, { cycleId });
      await onUpdated(saved);
      setStatusMessage('Cohort updated successfully.');
      setStatus('success');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not update cohort'));
      setStatus('error');
      unlock();
    }
  };

  return {
    cycleId,
    setCycleId,
    status,
    statusMessage,
    submissionComplete: status === 'submitting' || status === 'success',
    submit,
  };
}
