import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../common/components/ConfirmModal/types';
import { COHORT_QUERY_KEY } from '../../../../common/features/programming/queryKeys';
import { YOUTH_QUERY_KEY } from '../../../../common/features/youth/queryKeys';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../query/infiniteListCache';
import { deleteLead } from '../../leads.api';
import type { CreateLeadStatusNoteResult, Lead } from '../../types';

interface UseLeadActionsOptions {
  tableQueryKey: readonly unknown[];
  onLeadSynced?: (lead: Lead) => void;
  onLeadRemoved?: (leadId: string) => void;
}

export default function useLeadActions({
  tableQueryKey,
  onLeadSynced,
  onLeadRemoved,
}: UseLeadActionsOptions) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const actionGenerations = useRef(new Map<string, number>());

  const nextActionGeneration = useCallback((leadId: string) => {
    const generation = (actionGenerations.current.get(leadId) ?? 0) + 1;
    actionGenerations.current.set(leadId, generation);
    return generation;
  }, []);

  const refreshLeads = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: tableQueryKey });
  }, [tableQueryKey, queryClient]);

  const applyLead = useCallback((lead: Lead) => {
    replaceInfiniteListRow(queryClient, tableQueryKey, lead);
    onLeadSynced?.(lead);
  }, [onLeadSynced, queryClient, tableQueryKey]);

  const syncLead = useCallback((lead: Lead) => {
    nextActionGeneration(lead.id);
    applyLead(lead);
  }, [applyLead, nextActionGeneration]);

  const requestDelete = useCallback((lead: Lead) => setConfirmAction({
    title: 'Delete Lead',
    message: `Delete ${lead.youthFirstName} ${lead.youthLastName} and all follow-up notes? This cannot be undone.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'Lead deleted',
    onConfirm: async () => {
      await deleteLead(lead.id);
      nextActionGeneration(lead.id);
      removeInfiniteListRow(queryClient, tableQueryKey, lead.id);
      onLeadRemoved?.(lead.id);
    },
  }), [nextActionGeneration, onLeadRemoved, queryClient, tableQueryKey]);

  const reconcileSignUp = useCallback(async (lead: Lead) => {
    syncLead(lead);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
    ]);
  }, [queryClient, syncLead]);

  const reconcileStatusNote = useCallback(async (result: CreateLeadStatusNoteResult) => {
    syncLead(result.lead);
    await queryClient.invalidateQueries({ queryKey: ['leads', result.lead.id, 'notes'] });
  }, [queryClient, syncLead]);

  return {
    confirmAction,
    closeConfirmation: () => setConfirmAction(null),
    requestDelete,
    syncLead,
    refreshLeads,
    reconcileSignUp,
    reconcileStatusNote,
  };
}
