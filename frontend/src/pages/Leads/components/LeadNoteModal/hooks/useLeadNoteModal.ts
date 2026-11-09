import { useState } from 'react';

import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import {
  getSubmitStatusMessage,
  useSubmitStatus,
} from '../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../http/errors';

import { createLeadNote, updateLeadNote } from '../../../leads.api';
import type { Lead, LeadNote } from '../../../types';

interface UseLeadNoteModalOptions {
  lead: Pick<Lead, 'id'>;
  note?: LeadNote;
  onSaved: (note: LeadNote) => void;
}

/**
 * Initializes and saves one follow-up note draft for the mounted editor.
 * @param options - Lead to add a note to, or its saved note to edit, and the save callback.
 * @example useLeadNoteModal({ lead, note, onSaved }) // starts with the saved note's details
 */
export default function useLeadNoteModal({
  lead,
  note,
  onSaved,
}: UseLeadNoteModalOptions) {
  const [details, setDetails] = useState(note?.details ?? '');
  const submitLock = useSubmitLock();

  const {
    submitStatus,
    setSubmitStatus,
    error,
    setError,
  } = useSubmitStatus();

  const submit = async () => {
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
      result = note
        ? await updateLeadNote(lead.id, note.id, normalizedDetails)
        : await createLeadNote(lead.id, normalizedDetails);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Could not save the follow-up note'));
      setSubmitStatus('error');
      submitLock.unlock();
      return;
    }

    setSubmitStatus('success');
    onSaved(result);
  };

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const statusMessage = getSubmitStatusMessage(submitStatus, error, {
    submitting: note ? 'Saving follow-up note...' : 'Adding follow-up note...',
    success: note ? 'Follow-up note saved.' : 'Follow-up note added.',
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
