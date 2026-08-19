import { useEffect, useRef, useState, type FormEvent } from 'react';

import { setYouthProfileNote } from '../../../../../common/features/youth/youth.api';
import {
  getSubmitStatusMessage,
  useSubmitStatus,
} from '../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import type {
  YouthProfileNote,
  YouthProfileNoteCategory,
} from '../../../../../common/types/youth';
import { getErrorMessage } from '../../../../../http/clientErrors';

interface ProfileNoteDraft {
  category: YouthProfileNoteCategory;
  title: string;
  details: string;
}

export interface UseProfileNoteModalOptions {
  youthId: string;
  note?: YouthProfileNote | null;
  onSaved: (note: YouthProfileNote) => void;
}

function buildDraft(note?: YouthProfileNote | null): ProfileNoteDraft {
  return {
    category: note?.category ?? 'general',
    title: note?.title ?? '',
    details: note?.details ?? '',
  };
}

export default function useProfileNoteModal({
  youthId,
  note,
  onSaved,
}: UseProfileNoteModalOptions) {
  const [draft, setDraft] = useState(() => buildDraft(note));
  const initialDraftRef = useRef(buildDraft(note));
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const targetKey = `${youthId}:${note?.id ?? 'new'}`;
  const submitLock = useSubmitLock();
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const statusMessage = getSubmitStatusMessage(submitStatus, error, {
    submitting: 'Saving note...',
    success: note ? 'Profile note updated.' : 'Profile note added.',
  });
  initialDraftRef.current = buildDraft(note);

  // A new create or edit target starts a fresh form lifecycle.
  useEffect(() => {
    setDraft(initialDraftRef.current);
    resetStatus();
  }, [resetStatus, targetKey]);

  // Draft events.
  const selectCategory = (category: YouthProfileNoteCategory) => {
    setDraft(current => ({ ...current, category }));
  };
  const updateTitle = (title: string) => {
    setDraft(current => ({ ...current, title }));
  };
  const updateDetails = (details: string) => {
    setDraft(current => ({ ...current, details }));
  };

  // Submission boundary.
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = draft.title.trim();
    if (!title) {
      setError('Enter a note title.');
      setSubmitStatus('error');
      return;
    }

    if (!submitLock.tryLock()) return;

    setError('');
    setSubmitStatus('submitting');

    const input = {
      category: draft.category,
      title,
      details: draft.details.trim() || null,
    };

    let saved: YouthProfileNote;
    try {
      saved = note
        ? await setYouthProfileNote(youthId, input, note.id)
        : await setYouthProfileNote(youthId, input);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Failed to save profile note'));
      setSubmitStatus('error');
      submitLock.unlock();
      return;
    }

    setSubmitStatus('success');
    submitLock.unlock();
    onSaved(saved);
  };

  return {
    draft,
    submitStatus,
    statusMessage,
    submissionComplete,
    selectCategory,
    updateTitle,
    updateDetails,
    submit,
  };
}
