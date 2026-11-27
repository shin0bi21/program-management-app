import { useForm } from 'react-hook-form';

import { setYouthProfileNote } from '../../../youth.api';
import {
  getSubmitStatusMessage,
  useSubmitStatus,
} from '../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import type { YouthProfileNote, YouthProfileNoteCategory } from '../../../types';
import { getErrorMessage } from '../../../../../http/errors';

interface ProfileNoteDraft {
  category: YouthProfileNoteCategory | '';
  details: string;
}

export interface UseProfileNoteModalOptions {
  youthId: string;
  note?: YouthProfileNote | null;
  onSaved: (note: YouthProfileNote) => void;
}

/**
 * Owns one mounted profile-note draft and saves its supplied youth/note target.
 * @param options - Youth ID, optional saved note, and authoritative save callback.
 * @example useProfileNoteModal({ youthId, note, onSaved }) // edits supplied note values
 */
export default function useProfileNoteModal({
  youthId,
  note,
  onSaved,
}: UseProfileNoteModalOptions) {
  const { register, watch, setValue, handleSubmit } = useForm<ProfileNoteDraft>({ defaultValues: {
    category: note?.category ?? '',
    details: note?.details ?? '',
  } });
  const draft = watch();
  const { submitStatus, setSubmitStatus, error, setError } = useSubmitStatus();
  const submitLock = useSubmitLock();
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const statusMessage = getSubmitStatusMessage(submitStatus, error, {
    submitting: 'Saving note...',
    success: note ? 'Profile note updated.' : 'Profile note added.',
  });
  // Draft events.
  const selectCategory = (category: YouthProfileNoteCategory) => {
    setValue('category', category);
  };

  // Submission boundary.
  /** Saves validated note values for this editor. @example await saveNote(draft) */
  async function saveNote(draft: ProfileNoteDraft): Promise<void> {
    const details = draft.details.trim();
    if (!details) {
      setError('Enter a note.');
      setSubmitStatus('error');
      return;
    }

    if (!draft.category) {
      setError('Choose a category.');
      setSubmitStatus('error');
      return;
    }

    if (!submitLock.tryLock()) return;

    setError('');
    setSubmitStatus('submitting');

    const input = {
      category: draft.category,
      details,
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
    onSaved(saved);
  }

  return {
    draft,
    submitStatus,
    statusMessage,
    submissionComplete,
    selectCategory,
    detailsField: register('details'),
    setValue,
    submit: handleSubmit(saveNote),
  };
}
