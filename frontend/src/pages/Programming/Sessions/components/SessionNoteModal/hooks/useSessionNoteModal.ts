import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  createSessionNote,
  getSessionRoster,
  updateSessionNote,
} from '../../../sessions.api';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import type {
  ProgramSession,
  SessionNote,
  SessionNoteCategory,
  SessionRosterMember,
} from '../../../types';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import { getErrorMessage } from '../../../../../../http/errors';

interface SessionNoteDraft {
  category: SessionNoteCategory | '';
  details: string;
  selectedYouthIds: string[];
}

export interface UseSessionNoteModalOptions {
  session: Pick<ProgramSession, 'id' | 'enrollmentRequired'>;
  note?: SessionNote | null;
  initialYouthId?: string;
  hideYouthSelection?: boolean;
  onSaved: () => void | Promise<void>;
}

/**
 * Owns one mounted note draft from supplied values and loads optional youth choices.
 * @param options - Saved session/note, optional youth context, and completion action.
 * @example useSessionNoteModal({ session, note, onSaved }) // edits the supplied note
 */
export default function useSessionNoteModal({
  session,
  note = null,
  initialYouthId,
  hideYouthSelection = false,
  onSaved,
}: UseSessionNoteModalOptions) {
  const [draft, setDraft] = useState<SessionNoteDraft>(() => ({
    category: note?.category ?? '',
    details: note?.details ?? '',
    selectedYouthIds: note?.youth.map(youth => youth.youthId) ?? (initialYouthId ? [initialYouthId] : []),
  }));
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const submitLock = useSubmitLock();

  // Youth links are optional, so roster loading does not block note submission.
  const rosterQuery = useQuery<SessionRosterMember[]>({
    queryKey: ['sessions', session.id, 'roster'],
    queryFn: ({ signal }) => getSessionRoster(session.id, { signal }),
    enabled: !hideYouthSelection,
  });

  const updateCategory = (category: SessionNoteCategory) => {
    setDraft(current => ({ ...current, category }));
  };
  const updateDetails = (details: string) => {
    setDraft(current => ({ ...current, details }));
  };
  const toggleYouth = (youthId: string) => {
    setDraft(current => ({
      ...current,
      selectedYouthIds: current.selectedYouthIds.includes(youthId)
        ? current.selectedYouthIds.filter(id => id !== youthId)
        : [...current.selectedYouthIds, youthId],
    }));
  };

  const submit = async () => {
    const details = draft.details.trim();
    if (!details) {
      setSubmitStatus('error');
      setStatusMessage('Enter a note.');
      return;
    }

    if (!draft.category) {
      setSubmitStatus('error');
      setStatusMessage('Choose a category.');
      return;
    }

    if (!submitLock.tryLock()) return;

    setSubmitStatus('submitting');
    setStatusMessage(note ? 'Saving session note...' : 'Adding session note...');

    const data = {
      category: draft.category,
      details,
      youthIds: draft.selectedYouthIds,
    };

    try {
      if (note) await updateSessionNote(session.id, note.id, data);
      else await createSessionNote(session.id, data);
    } catch (cause) {
      setStatusMessage(cause instanceof Error
        ? cause.message
        : `Could not ${note ? 'update' : 'add'} session note`);
      setSubmitStatus('error');
      submitLock.unlock();
      return;
    }

    let refreshFailed = false;
    try {
      await onSaved();
    } catch {
      refreshFailed = true;
    }

    let message = note ? 'Session note successfully updated.' : 'Session note successfully added.';
    if (refreshFailed) message = 'Session note was saved, but the page could not refresh. Reload to see it.';
    setStatusMessage(message);
    setSubmitStatus('success');
  };

  return {
    draft,
    roster: rosterQuery.data ?? [],
    rosterLoading: rosterQuery.isLoading,
    rosterError: rosterQuery.error ? getErrorMessage(rosterQuery.error, 'Could not load session roster') : undefined,
    submitStatus,
    statusMessage: statusMessage || undefined,
    submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    updateCategory,
    updateDetails,
    toggleYouth,
    submit,
  };
}
