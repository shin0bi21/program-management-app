import { useEffect, useState } from 'react';

import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import {
  getSubmitStatusMessage,
  useSubmitStatus,
} from '../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../http/errors';

import { createLeadStatusNote } from '../../../leads.api';
import type { CreateLeadStatusNoteResult, EditableLeadStatus, Lead } from '../../../types';

interface UseLeadNoteModalOptions {
  lead: Pick<Lead, 'id' | 'status'> | null;
  initialStatus?: EditableLeadStatus;
  onSaved: (result: CreateLeadStatusNoteResult) => void;
}

export default function useLeadNoteModal({
  lead,
  initialStatus,
  onSaved,
}: UseLeadNoteModalOptions) {
  const [category, setCategory] = useState<EditableLeadStatus>('new');
  const [details, setDetails] = useState('');
  const submitLock = useSubmitLock();
  const isOpen = lead !== null;
  const targetKey = lead ? `${lead.id}:${initialStatus ?? lead.status}` : 'closed';
  const initialCategory = initialStatus ?? (lead?.status === 'signed_up' ? 'new' : lead?.status ?? 'new');

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
    setCategory(initialCategory);
    setDetails('');
    resetStatus();
  }, [initialCategory, isOpen, resetStatus, targetKey]);

  const submit = async () => {
    if (!lead) return;

    const normalizedDetails = details.trim();
    if (!normalizedDetails) {
      setError('Enter a status note.');
      setSubmitStatus('error');
      return;
    }
    if (normalizedDetails.length > 500) {
      setError('Status note must be 500 characters or fewer.');
      setSubmitStatus('error');
      return;
    }
    if (!submitLock.tryLock()) return;

    setError('');
    setSubmitStatus('submitting');

    let result: CreateLeadStatusNoteResult;
    try {
      result = await createLeadStatusNote(lead.id, category, normalizedDetails);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Could not save the status update'));
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
    submitting: 'Adding status update...',
    success: 'Status updated.',
  });

  return {
    category,
    details,
    updateCategory: setCategory,
    updateDetails: setDetails,
    submitStatus,
    statusMessage,
    submissionComplete,
    submit,
  };
}
