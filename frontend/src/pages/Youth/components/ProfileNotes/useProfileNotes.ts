import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  deleteYouthProfileNote,
} from '../../youth.api';
import type { YouthProfileNote } from '../../types';
import type { ConfirmAction } from '../../../../common/components/ConfirmModal/types';

/**
 * Identifies the saved profile notes for one youth.
 * @param youthId - Selected youth ID, or null before a selection is made.
 * @example profileNotesQueryKey('youth-1') // ['youth-profile-notes', 'youth-1']
 */
export const profileNotesQueryKey = (youthId: string | null) => ['youth-profile-notes', youthId] as const;

/**
 * Owns page-spanning profile-note dialogs and saved-note cache updates.
 * @param selectedYouthId - Current selection used by dashboard actions; row actions may supply another ID.
 * @example useProfileNotes(selectedYouthId).openEditor('new', row.id)
 */
export default function useProfileNotes(selectedYouthId: string | null) {
  const queryClient = useQueryClient();
  const [editorTarget, setEditorTarget] = useState<{
    youthId: string;
    note: YouthProfileNote | 'new';
  } | null>(null);
  const [selectedNote, setSelectedNote] = useState<YouthProfileNote | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    setEditorTarget(current => current?.youthId === selectedYouthId ? current : null);
    setSelectedNote(null);
    setConfirmAction(null);
  }, [selectedYouthId]);

  const closeDetails = useCallback(() => setSelectedNote(null), []);

  const openEditor = useCallback((note: YouthProfileNote | 'new', youthId = selectedYouthId) => {
    if (!youthId) throw new Error('A selected youth profile is required to edit profile notes');
    setEditorTarget({ youthId, note });
    if (note !== 'new') setSelectedNote(null);
  }, [selectedYouthId]);

  const handleSaved = useCallback((note: YouthProfileNote) => {
    if (!editorTarget) throw new Error('An open profile note editor is required to save a profile note');
    const shouldReturnToDetails = editorTarget.note !== 'new';

    queryClient.setQueryData<YouthProfileNote[]>(profileNotesQueryKey(editorTarget.youthId), current => {
      const notes = current ?? [];
      const existingIndex = notes.findIndex(item => item.id === note.id);
      return existingIndex === -1
        ? [note, ...notes]
        : notes.map(item => item.id === note.id ? note : item);
    });

    if (shouldReturnToDetails) setSelectedNote(note);
  }, [editorTarget, queryClient]);

  const requestDelete = useCallback((note: YouthProfileNote) => {
    setSelectedNote(note);
    setConfirmAction({
      title: 'Delete Profile Note',
      message: 'Delete this profile note? This cannot be undone.',
      confirmVariant: 'danger',
      successMessage: 'Profile note deleted.',
      onConfirm: async () => {
        await deleteYouthProfileNote(note.youthId, note.id);
        queryClient.setQueryData<YouthProfileNote[]>(profileNotesQueryKey(note.youthId), current =>
          current?.filter(candidate => candidate.id !== note.id) ?? [],
        );
        setSelectedNote(current => current?.id === note.id ? null : current);
      },
    });
  }, [queryClient]);

  return {
    editorTarget,
    selectedNote,
    confirmAction,
    openEditor,
    closeEditor: () => setEditorTarget(null),
    openDetails: setSelectedNote,
    closeDetails,
    handleSaved,
    requestDelete,
    closeConfirmation: () => setConfirmAction(null),
  };
}
