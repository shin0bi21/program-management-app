import { useEffect, useState } from 'react';

import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import {
  getSubmitStatusMessage,
  useSubmitStatus,
} from '../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../http/errors';

import { createLeadNote } from '../../../leads.api';
import type { Lead, LeadNote } from '../../../types';

interface UseLeadNoteModalOptions {
  lead: Pick<Lead, 'id'> | null;
  onSaved: (note: LeadNote) => void;
}

export default function useLeadNoteModal({
  lead,
  onSaved,
}: UseLeadNoteModalOptions) {
  const [details, setDetails] = useState('');
  const submitLock = useSubmitLock();
  const isOpen = lead !== null;
  const targetKey = lead?.id ?? 'closed';

  const {
    submitStatus,
    setSubmitStatus,
    error,
    setError,
    resetStatus,
  } = useSubmitStatus();

  // A different lead or note target starts a fresh editor lifecycle.
  useEffect(() => {
    if (!isOpen) return;
    setDetails('');
    resetStatus();
  }, [isOpen, resetStatus, targetKey]);

  const submit = async () => {
    if (!lead) return;

    const normalizedDetails = details.trim();
    if (!normalizedDetails) {
      setError('Enter a follow-up note.');
      setSubmitStatus('error');
      return;
    }
    if (normalizedDetails.length > 500) {
      setError('Follow-up note must be 500 characters or fewer.');
      setSubmitStatus('error');
      return;
    }
    if (!submitLock.tryLock()) return;

    setError('');
    setSubmitStatus('submitting');

    let result: LeadNote;
    try {
      result = await createLeadNote(lead.id, normalizedDetails);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Could not save the follow-up note'));
      setSubmitStatus('error');
      submitLock.unlock();
      return;
    }

    setSubmitStatus('success');
    submitLock.unlock();
    onSaved(result);
  };

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const statusMessage = getSubmitStatusMessage(submitStatus, error, {
    submitting: 'Adding follow-up note...',
    success: 'Follow-up note added.',
  });

  return {
    details,
    updateDetails: setDetails,
    submitStatus,
    statusMessage,
    submissionComplete,
    submit,
  };
}
