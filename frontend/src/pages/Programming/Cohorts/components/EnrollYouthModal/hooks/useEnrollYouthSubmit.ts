import { useEffect } from 'react';

import { enrollYouth } from '../../../../../../common/features/programming/api/cohorts.api';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import { useSubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/clientErrors';

interface UseEnrollYouthSubmitOptions {
  cohortId?: string;
  selectedYouthIds: string[];
  onSuccess: () => void | Promise<void>;
}

export function useEnrollYouthSubmit({
  cohortId,
  selectedYouthIds,
  onSuccess,
}: UseEnrollYouthSubmitOptions) {
  const { tryLock, unlock } = useSubmitLock();
  const {
    submitStatus,
    setSubmitStatus,
    error,
    setError,
    resetStatus,
  } = useSubmitStatus();

  useEffect(() => {
    if (!cohortId) return;
    unlock();
    resetStatus();
  }, [cohortId, resetStatus, unlock]);

  const submit = async () => {
    if (!cohortId || !selectedYouthIds.length || !tryLock()) return;

    setSubmitStatus('submitting');
    setError('');

    try {
      await enrollYouth(cohortId, { youthIds: selectedYouthIds });
    } catch (cause) {
      setError(getErrorMessage(cause, 'Could not enroll youth'));
      setSubmitStatus('error');
      unlock();
      return;
    }

    try {
      await onSuccess();
    } catch {
      setError('Youth were enrolled, but the roster could not refresh. Reload to see them.');
    }

    setSubmitStatus('success');
  };

  return { submitStatus, submitError: error || null, submit };
}
