import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteYouthProfileNote,
  getYouthProfileNotes,
} from '../../../../common/features/youth/youth.api';
import type { YouthProfileNote } from '../../../../common/types/youth';
import { getErrorMessage } from '../../../../http/clientErrors';

const profileNotesQueryKey = (youthId: string | null) => ['youth-profile-notes', youthId] as const;

export default function useProfileNotes(selectedYouthId: string | null) {
  const queryClient = useQueryClient();
  const [editorTarget, setEditorTarget] = useState<{
    youthId: string;
    note: YouthProfileNote | 'new';
  } | null>(null);
  const [selectedNote, setSelectedNote] = useState<YouthProfileNote | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const query = useQuery({
    queryKey: profileNotesQueryKey(selectedYouthId),
    queryFn: ({ signal }) => {
      if (!selectedYouthId) throw new Error('A selected youth profile is required to load profile notes');
      return getYouthProfileNotes(selectedYouthId, { signal });
    },
    enabled: selectedYouthId !== null,
  });

  useEffect(() => {
    setEditorTarget(current => current?.youthId === selectedYouthId ? current : null);
    setSelectedNote(null);
    setConfirmingDelete(false);
    setDeleting(false);
    setDeleteError('');
  }, [selectedYouthId]);

  const closeDetails = useCallback(() => {
    if (deleting) return;
    setSelectedNote(null);
    setConfirmingDelete(false);
    setDeleteError('');
  }, [deleting]);

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
    setConfirmingDelete(true);
    setDeleteError('');
  }, []);

  const cancelDelete = useCallback(() => {
    setConfirmingDelete(false);
    setDeleteError('');
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!selectedNote) throw new Error('A selected profile note is required for deletion');
    const target = selectedNote;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteYouthProfileNote(target.youthId, target.id);
      queryClient.setQueryData<YouthProfileNote[]>(profileNotesQueryKey(target.youthId), current =>
        current?.filter(note => note.id !== target.id) ?? [],
      );
      setSelectedNote(null);
      setConfirmingDelete(false);
    } catch (cause) {
      setDeleteError(getErrorMessage(cause, 'Failed to delete profile note'));
    } finally {
      setDeleting(false);
    }
  }, [queryClient, selectedNote]);

  return {
    notes: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? 'Could not load profile notes' : null,
    editorTarget,
    selectedNote,
    confirmingDelete,
    deleting,
    deleteError,
    openEditor,
    closeEditor: () => setEditorTarget(null),
    openDetails: setSelectedNote,
    closeDetails,
    handleSaved,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
