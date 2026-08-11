import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../../common/components/Modal/hooks/useConfirmModal';
import { deleteLeadNote, getLeadNotes } from '../../api/leads.api';
import type { Lead, LeadNote } from '../../types';

const leadNotesQueryKey = (leadId: string | null) => ['leads', leadId, 'notes'] as const;

export interface LeadNoteTarget {
  lead: Lead;
  note: LeadNote | null;
}

export default function useLeadNotes(lead: Lead | null) {
  const queryClient = useQueryClient();
  const [noteTarget, setNoteTarget] = useState<LeadNoteTarget | null>(null);
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
    setNoteTarget(current => current?.lead.id === leadId ? current : null);
    setConfirmAction(null);
  }, [leadId]);

  const openCreate = useCallback(() => {
    if (!lead) throw new Error('A selected lead is required to add a follow-up note');
    setNoteTarget({ lead, note: null });
  }, [lead]);

  const openEdit = useCallback((note: LeadNote) => {
    if (!lead || note.leadId !== lead.id) {
      throw new Error('The follow-up note must belong to the selected lead');
    }
    setNoteTarget({ lead, note });
  }, [lead]);

  const reconcileSavedNote = useCallback((savedNote: LeadNote) => {
    if (!noteTarget) throw new Error('An open follow-up-note editor is required to save a note');
    if (savedNote.leadId !== noteTarget.lead.id) {
      throw new Error('The saved follow-up note does not belong to its editor target');
    }

    queryClient.setQueryData<LeadNote[]>(leadNotesQueryKey(noteTarget.lead.id), current => {
      const notes = current ?? [];
      return notes.some(note => note.id === savedNote.id)
        ? notes.map(note => note.id === savedNote.id ? savedNote : note)
        : [savedNote, ...notes];
    });
  }, [noteTarget, queryClient]);

  const requestDelete = useCallback((note: LeadNote) => {
    if (!lead || note.leadId !== lead.id) {
      throw new Error('The follow-up note must belong to the selected lead');
    }
    const targetLeadId = lead.id;
    setConfirmAction({
      title: 'Delete Follow-up Note',
      message: 'Delete this follow-up note? This cannot be undone.',
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      successMessage: 'Follow-up note deleted.',
      onConfirm: async () => {
        await deleteLeadNote(targetLeadId, note.id);
        queryClient.setQueryData<LeadNote[]>(leadNotesQueryKey(targetLeadId), current => {
          if (!current) return current;
          return current.filter(currentNote => currentNote.id !== note.id);
        });
      },
    });
  }, [lead, queryClient]);
  const closeEditor = useCallback(() => setNoteTarget(null), []);
  const closeConfirmation = useCallback(() => setConfirmAction(null), []);

  return {
    notes: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    noteTarget,
    confirmAction,
    openCreate,
    openEdit,
    closeEditor,
    reconcileSavedNote,
    requestDelete,
    closeConfirmation,
  };
}
