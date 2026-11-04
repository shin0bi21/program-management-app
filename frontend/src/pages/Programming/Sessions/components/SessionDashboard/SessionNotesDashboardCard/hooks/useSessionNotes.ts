import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../../../../common/components/ConfirmModal/types';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import { deleteSessionNote, getSessionNotes } from '../../../../sessions.api';
import type { ProgramSession, SessionNote } from '../../../../types';

export function useSessionNotes({ queryKey, session, onMessageChange }: {
  queryKey: readonly unknown[];
  session: ProgramSession | null;
  onMessageChange?: PageMessageChangeHandler;
}) {
  const [noteTarget, setNoteTarget] = useState<ProgramSession | null>(null);
  const [editNote, setEditNote] = useState<SessionNote | null>(null);
  const [detailNote, setDetailNote] = useState<SessionNote | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const query = useQuery({
    queryKey: [...queryKey, session?.id, 'notes'],
    queryFn: ({ signal }) => getSessionNotes(session!.id, { signal }),
    enabled: session !== null,
  });
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: query.refetch }), [query.refetch]);
  usePageMessageReporter(onMessageChange, query.error ? 'Could not load session notes.' : null, retryAction);

  useEffect(() => {
    setNoteTarget(null);
    setEditNote(null);
    setDetailNote(null);
    setConfirmAction(null);
  }, [session?.id]);

  const loadNotes = async () => { await query.refetch(); };
  const openAdd = () => { if (session) setNoteTarget(session); };
  const openEdit = (note: SessionNote) => {
    if (!session) return;
    setEditNote(note);
    setNoteTarget(session);
  };
  const closeEditor = () => { setNoteTarget(null); setEditNote(null); };
  const requestDelete = (note: SessionNote) => {
    if (!session) return;
    setConfirmAction({
      title: 'Delete Note',
      message: 'Delete this session note? This cannot be undone.',
      confirmVariant: 'danger',
      successMessage: 'Session note successfully deleted.',
      onConfirm: async () => {
        await deleteSessionNote(session.id, note.id);
        await loadNotes();
        if (detailNote?.id === note.id) setDetailNote(null);
      },
    });
  };

  return {
    query, noteTarget, editNote, detailNote, confirmAction, loadNotes,
    openAdd, openEdit, closeEditor, setDetailNote, requestDelete, setConfirmAction,
  };
}
