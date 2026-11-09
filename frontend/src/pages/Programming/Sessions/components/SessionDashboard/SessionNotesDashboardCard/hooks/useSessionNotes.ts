import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../../../../common/components/ConfirmModal/types';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import { deleteSessionNote, getSessionNotes } from '../../../../sessions.api';
import type { ProgramSession, SessionNote } from '../../../../types';

/**
 * Owns this session's notes query and ID-based editor and viewer targets.
 * Saved records resolve from the current session and complete query result; drafts stay with the modal.
 * @param options - Current saved session, query scope, and page-message reporter.
 * @example useSessionNotes({ queryKey: ['sessions'], session })
 */
export function useSessionNotes({ queryKey, session, onMessageChange }: {
  queryKey: readonly unknown[];
  session: ProgramSession | null;
  onMessageChange?: PageMessageChangeHandler;
}) {
  const client = useQueryClient();
  const currentSessionId = useRef(session?.id);
  currentSessionId.current = session?.id;
  const [editorSessionId, setEditorSessionId] = useState<string | null>(null);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [detailNoteId, setDetailNoteId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const childQueryKey = [...queryKey, session?.id, 'notes'];
  const query = useQuery({
    queryKey: childQueryKey,
    queryFn: ({ signal }) => getSessionNotes(session!.id, { signal }),
    enabled: session !== null,
  });
  const editNote = query.data?.find(note => note.id === editNoteId) ?? null;
  const detailNote = query.data?.find(note => note.id === detailNoteId) ?? null;
  const isEditorAvailable = editNoteId === null || editNote !== null;
  const noteTarget = session?.id === editorSessionId && isEditorAvailable ? session : null;
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: query.refetch }), [query.refetch]);
  usePageMessageReporter(onMessageChange, query.error ? 'Could not load session notes.' : null, retryAction);

  useEffect(() => {
    setEditorSessionId(null);
    setEditNoteId(null);
    setDetailNoteId(null);
    setConfirmAction(null);
  }, [session?.id]);

  /**
   * Keeps a departing session's async work from refreshing the active query.
   * @example isCurrentTarget() // false after the selected session changes
   */
  const isCurrentTarget = () => currentSessionId.current === session?.id;
  const loadNotes = async () => {
    if (!isCurrentTarget()) return;

    await query.refetch();
  };
  const openAdd = () => {
    if (!session) return;

    setEditNoteId(null);
    setEditorSessionId(session.id);
  };
  const openEdit = (note: SessionNote) => {
    if (!session) return;

    setEditNoteId(note.id);
    setEditorSessionId(session.id);
  };
  const closeEditor = () => { setEditorSessionId(null); setEditNoteId(null); };
  const setDetailNote = (note: SessionNote | null) => {
    setDetailNoteId(note?.id ?? null);
  };
  const requestDelete = (note: SessionNote) => {
    if (!session) return;

    setConfirmAction({
      title: 'Delete Note',
      message: 'Delete this session note? This cannot be undone.',
      confirmVariant: 'danger',
      successMessage: 'Session note successfully deleted.',
      onConfirm: async () => {
        if (!isCurrentTarget()) return;

        await deleteSessionNote(session.id, note.id);
        if (!isCurrentTarget()) return;

        // Confirmed deletion remains authoritative if the follow-up list refresh fails.
        client.setQueryData<SessionNote[]>(childQueryKey, current =>
          current?.filter(candidate => candidate.id !== note.id),
        );
        setDetailNoteId(current => current === note.id ? null : current);
        await loadNotes();
      },
    });
  };

  return {
    query, noteTarget, editNote, detailNote, confirmAction, loadNotes,
    openAdd, openEdit, closeEditor, setDetailNote, requestDelete, setConfirmAction,
  };
}
