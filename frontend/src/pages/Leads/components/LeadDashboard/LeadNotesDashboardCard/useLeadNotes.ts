import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLeadNotes } from '../../../leads.api';
import type { Lead, LeadNote } from '../../../types';

const leadNotesQueryKey = (leadId: string | null) => ['leads', leadId, 'notes'] as const;

export default function useLeadNotes(lead: Lead | null) {
  const queryClient = useQueryClient();
  const [selectedNote, setSelectedNote] = useState<LeadNote | null>(null);
  const [editorTarget, setEditorTarget] = useState<LeadNote | null>(null);
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
  }, [leadId]);

  const openDetails = useCallback((note: LeadNote) => setSelectedNote(note), []);
  const closeDetails = useCallback(() => setSelectedNote(null), []);
  const openEditor = useCallback((note: LeadNote) => {
    setSelectedNote(null);
    setEditorTarget(note);
  }, []);
  const closeEditor = useCallback(() => setEditorTarget(null), []);
  const handleSaved = useCallback((note: LeadNote) => {
    queryClient.setQueryData<LeadNote[]>(leadNotesQueryKey(note.leadId), current =>
      current?.map(candidate => candidate.id === note.id ? note : candidate) ?? [note],
    );
  }, [queryClient]);


  return {
    notes: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
    selectedNote,
    editorTarget,
    openDetails,
    closeDetails,
    openEditor,
    closeEditor,
    handleSaved,
  };
}
