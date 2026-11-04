import { useEffect, useRef, useState } from 'react';
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

interface SessionNoteDraft {
  category: SessionNoteCategory;
  details: string;
  selectedYouthIds: string[];
}

export interface UseSessionNoteModalOptions {
  session: Pick<ProgramSession, 'id' | 'enrollmentRequired'> | null;
  note?: SessionNote | null;
  initialYouthId?: string;
  hideYouthSelection?: boolean;
  onSaved: () => void | Promise<void>;
}

function buildDraft(note: SessionNote | null, initialYouthId?: string): SessionNoteDraft {
  return {
    category: note?.category ?? 'general',
    details: note?.details ?? '',
    selectedYouthIds: note?.youth.map(youth => youth.youthId)
      ?? (initialYouthId ? [initialYouthId] : []),
  };
}

export default function useSessionNoteModal({
  session,
  note = null,
  initialYouthId,
  hideYouthSelection = false,
  onSaved,
}: UseSessionNoteModalOptions) {
  const [draft, setDraft] = useState(() => buildDraft(note, initialYouthId));
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const initialDraftRef = useRef(buildDraft(note, initialYouthId));
  const targetKey = session
    ? `${session.id}:${note?.id ?? 'new'}:${initialYouthId ?? ''}`
    : 'closed';
  const isOpen = session !== null;
  const submitLock = useSubmitLock();
  initialDraftRef.current = buildDraft(note, initialYouthId);

  // A new session or note target starts a fresh editor lifecycle.
  useEffect(() => {
    if (isOpen) {
      setDraft(initialDraftRef.current);
      setSubmitStatus('idle');
      setStatusMessage('');
    }
  }, [isOpen, targetKey]);

  // Youth links are optional, so roster loading does not block note submission.
  const rosterQuery = useQuery<SessionRosterMember[]>({
    queryKey: ['sessions', session?.id, 'roster'],
    queryFn: ({ signal }) => getSessionRoster(session!.id, { signal }),
    enabled: session !== null && !hideYouthSelection,
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
    if (!session) return;
    const details = draft.details.trim();
    if (!details) {
      setSubmitStatus('error');
      setStatusMessage('Enter a note.');
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

    setStatusMessage(refreshFailed
      ? 'Session note was saved, but the page could not refresh. Reload to see it.'
      : note ? 'Session note successfully updated.' : 'Session note successfully added.');
    setSubmitStatus('success');
    submitLock.unlock();
  };

  return {
    draft,
    roster: rosterQuery.data ?? [],
    rosterLoading: rosterQuery.isLoading,
    rosterError: rosterQuery.error instanceof Error
      ? rosterQuery.error.message
      : rosterQuery.error ? 'Could not load session roster' : undefined,
    submitStatus,
    statusMessage: statusMessage || undefined,
    submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    updateCategory,
    updateDetails,
    toggleYouth,
    submit,
  };
}
