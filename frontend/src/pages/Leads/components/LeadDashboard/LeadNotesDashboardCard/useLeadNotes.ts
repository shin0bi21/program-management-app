import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLeadNotes } from '../../../leads.api';
import { deleteLeadNote } from '../../../leads.api';
import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import type { Lead, LeadNote } from '../../../types';

const leadNotesQueryKey = (leadId: string | null) => ['leads', leadId, 'notes'] as const;

export default function useLeadNotes(lead: Lead | null) {
  const queryClient = useQueryClient();
  const [selectedNote, setSelectedNote] = useState<LeadNote | null>(null);
  const [editorTarget, setEditorTarget] = useState<LeadNote | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const leadId = lead?.id ?? null;
  const query = useQuery({
    queryKey: leadNotesQueryKey(leadId),
    queryFn: ({ signal }) => {
      if (!leadId) throw new Error('A selected lead is required to load follow-up notes');
      return getLeadNotes(leadId, { signal });
    },
    enabled: leadId !== null,
  });

  useEffect(() => {
    setSelectedNote(null);
    setEditorTarget(null);
    setCreating(false);
    setConfirmAction(null);
  }, [leadId]);

  const openDetails = useCallback((note: LeadNote) => setSelectedNote(note), []);
  const closeDetails = useCallback(() => setSelectedNote(null), []);
  const openEditor = useCallback((note: LeadNote) => {
    setSelectedNote(null);
    setEditorTarget(note);
  }, []);
  const closeEditor = useCallback(() => setEditorTarget(null), []);
  const openCreate = useCallback(() => {
    if (!lead) throw new Error('A selected lead is required to add a follow-up note');
    setCreating(true);
  }, [lead]);
  const closeCreate = useCallback(() => setCreating(false), []);
  const handleSaved = useCallback((note: LeadNote) => {
    queryClient.setQueryData<LeadNote[]>(leadNotesQueryKey(note.leadId), current =>
      current?.map(candidate => candidate.id === note.id ? note : candidate) ?? [note],
    );
  }, [queryClient]);
  const handleCreated = useCallback((note: LeadNote) => {
    queryClient.setQueryData<LeadNote[]>(leadNotesQueryKey(note.leadId), current => [note, ...(current ?? [])]);
  }, [queryClient]);
  const requestDelete = useCallback((note: LeadNote) => setConfirmAction({
    title: 'Delete Follow-up Note',
    message: 'Delete this follow-up note? This cannot be undone.',
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'Follow-up note deleted',
    onConfirm: async () => {
      await deleteLeadNote(note.leadId, note.id);
      queryClient.setQueryData<LeadNote[]>(leadNotesQueryKey(note.leadId), current =>
        current?.filter(candidate => candidate.id !== note.id) ?? [],
      );
    },
  }), [queryClient]);


  return {
    notes: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
    selectedNote,
    editorTarget,
    creating,
    confirmAction,
    openDetails,
    closeDetails,
    openEditor,
    closeEditor,
    openCreate,
    closeCreate,
    handleSaved,
    handleCreated,
    requestDelete,
    closeConfirmation: () => setConfirmAction(null),
  };
}
