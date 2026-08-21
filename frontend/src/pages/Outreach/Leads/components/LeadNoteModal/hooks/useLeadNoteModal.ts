import { useEffect, useRef, useState } from 'react';

import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import {
  getSubmitStatusMessage,
  useSubmitStatus,
} from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';

import { setLeadNote } from '../../../leads.api';
import type { Lead, LeadNote } from '../../../types';

interface UseLeadNoteModalOptions {
  lead: Pick<Lead, 'id'> | null;
  note: LeadNote | null;
  onSaved: (savedNote: LeadNote) => void;
}

export default function useLeadNoteModal({
  lead,
  note,
  onSaved,
}: UseLeadNoteModalOptions) {
  const [details, setDetails] = useState(note?.details ?? '');
  const initialDetailsRef = useRef(note?.details ?? '');
  const submitLock = useSubmitLock();
  const isOpen = lead !== null;
  const targetKey = lead ? `${lead.id}:${note?.id ?? 'new'}` : 'closed';
  initialDetailsRef.current = note?.details ?? '';

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
    setDetails(initialDetailsRef.current);
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

    let savedNote: LeadNote;
    try {
      savedNote = note
        ? await setLeadNote(lead.id, normalizedDetails, note.id)
        : await setLeadNote(lead.id, normalizedDetails);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Could not save the follow-up note'));
      setSubmitStatus('error');
      submitLock.unlock();
      return;
    }

    setSubmitStatus('success');
    submitLock.unlock();
    onSaved(savedNote);
  };

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const statusMessage = getSubmitStatusMessage(submitStatus, error, {
    submitting: note ? 'Updating follow-up note...' : 'Adding follow-up note...',
    success: note ? 'Follow-up note updated.' : 'Follow-up note added.',
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
