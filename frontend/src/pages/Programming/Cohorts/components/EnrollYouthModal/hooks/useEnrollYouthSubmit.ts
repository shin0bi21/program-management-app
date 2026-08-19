import { useEffect, useRef } from 'react';

import { enrollYouth } from '../../../../../../common/features/programming/api/cohorts.api';
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
  const submittingRef = useRef(false);
  const {
    submitStatus,
    setSubmitStatus,
    error,
    setError,
    resetStatus,
  } = useSubmitStatus();

  useEffect(() => {
    if (!cohortId) return;
    submittingRef.current = false;
    resetStatus();
  }, [cohortId, resetStatus]);

  const submit = async () => {
    if (!cohortId || !selectedYouthIds.length || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitStatus('submitting');
    setError('');
    try {
      await enrollYouth(cohortId, { youthIds: selectedYouthIds });
      await onSuccess();
      setSubmitStatus('success');
    } catch (cause) {
      submittingRef.current = false;
      setError(getErrorMessage(cause, 'Could not enroll youth'));
      setSubmitStatus('error');
    }
  };

  return { submitStatus, submitError: error || null, submit };
}
