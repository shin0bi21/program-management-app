import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLeadNotes } from '../../../leads.api';
import type { Lead, LeadNote } from '../../../types';

const leadNotesQueryKey = (leadId: string | null) => ['leads', leadId, 'notes'] as const;

export default function useLeadNotes(lead: Lead | null) {
  const [selectedNote, setSelectedNote] = useState<LeadNote | null>(null);
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
  }, [leadId]);

  const openDetails = useCallback((note: LeadNote) => setSelectedNote(note), []);
  const closeDetails = useCallback(() => setSelectedNote(null), []);


  return {
    notes: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
    selectedNote,
    openDetails,
    closeDetails,
  };
}
