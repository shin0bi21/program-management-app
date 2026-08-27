import { useEffect, useState } from 'react';
import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import { getSubmitStatusMessage, useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../http/errors';
import { updateLeadNote } from '../../../leads.api';
import type { LeadNote } from '../../../types';

export default function useLeadNoteEditModal({ note, onSaved }: {
  note: LeadNote | null;
  onSaved: (note: LeadNote) => void;
}) {
  const [details, setDetails] = useState('');
  const submitLock = useSubmitLock();
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();

  useEffect(() => {
    if (!note) return;
    setDetails(note.details);
    resetStatus();
  }, [note, resetStatus]);

  const submit = async () => {
    if (!note) return;

    const normalizedDetails = details.trim();
    if (!normalizedDetails) {
      setError('Enter a follow-up note.');
      setSubmitStatus('error');
      return;
    }
    if (!submitLock.tryLock()) return;

    setError('');
    setSubmitStatus('submitting');
    try {
      const saved = await updateLeadNote(note.leadId, note.id, normalizedDetails);
      setSubmitStatus('success');
      onSaved(saved);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Could not update the follow-up note'));
      setSubmitStatus('error');
    } finally {
      submitLock.unlock();
    }
  };

  return {
    details,
    submitStatus,
    statusMessage: getSubmitStatusMessage(submitStatus, error, {
      submitting: 'Saving follow-up note...',
      success: 'Follow-up note saved.',
    }),
    updateDetails: setDetails,
    submit,
  };
}
