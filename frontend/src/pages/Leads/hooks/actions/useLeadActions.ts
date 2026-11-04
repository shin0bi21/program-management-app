import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../common/components/ConfirmModal/types';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../query/infiniteListCache';
import { deleteLead, updateLeadStatus, type LeadSignUpResult } from '../../leads.api';
import type { EditableLeadStatus, Lead } from '../../types';

import { updateProgramCycleAssignments } from '../../../Programming/Programs/hooks/actions/programCycleAssignmentCache';
const PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY = ['programs', 'cycle-assignments'] as const;
const YOUTH_TABLE_QUERY_KEY = ['youth', 'table'] as const;

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
  const [actionError, setActionError] = useState('');
  const actionGenerations = useRef(new Map<string, number>());

  const nextActionGeneration = useCallback((leadId: string) => {
    const generation = (actionGenerations.current.get(leadId) ?? 0) + 1;
    actionGenerations.current.set(leadId, generation);
    return generation;
  }, []);

  const isCurrentAction = useCallback(
    (leadId: string, generation: number) => actionGenerations.current.get(leadId) === generation,
    [],
  );

  const refreshLeads = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: tableQueryKey });
  }, [tableQueryKey, queryClient]);

  const applyLead = useCallback((lead: Lead) => {
    replaceInfiniteListRow(queryClient, tableQueryKey, lead);
    onLeadSynced?.(lead);
  }, [onLeadSynced, queryClient, tableQueryKey]);

  const syncLead = useCallback((lead: Lead) => {
    setActionError('');
    nextActionGeneration(lead.id);
    applyLead(lead);
  }, [applyLead, nextActionGeneration]);

  const setStatus = useCallback(async (lead: Lead, status: EditableLeadStatus) => {
    setActionError('');
    const generation = nextActionGeneration(lead.id);
    try {
      const savedLead = await updateLeadStatus(lead.id, status);
      if (isCurrentAction(lead.id, generation)) applyLead(savedLead);
    } catch {
      if (isCurrentAction(lead.id, generation)) setActionError('Unable to update lead status.');
    }
  }, [applyLead, isCurrentAction, nextActionGeneration]);

  const requestDelete = useCallback((lead: Lead) => setConfirmAction({
    title: 'Delete Lead',
    message: `Delete ${lead.youthFirstName} ${lead.youthLastName} and all follow-up notes? This cannot be undone.`,
    confirmVariant: 'danger',
    successMessage: 'Lead deleted',
    onConfirm: async () => {
      await deleteLead(lead.id);
      nextActionGeneration(lead.id);
      removeInfiniteListRow(queryClient, tableQueryKey, lead.id);
      onLeadRemoved?.(lead.id);
    },
  }), [nextActionGeneration, onLeadRemoved, queryClient, tableQueryKey]);

  const reconcileSignUp = useCallback(async (saved: LeadSignUpResult) => {
    syncLead(saved.lead);
    if (saved.updatedProgramCycle) {
      updateProgramCycleAssignments(queryClient, [saved.updatedProgramCycle]);
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: YOUTH_TABLE_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY }),
    ]);
  }, [queryClient, syncLead]);

  return {
    confirmAction,
    actionError,
    closeConfirmation: () => setConfirmAction(null),
    requestDelete,
    setStatus,
    syncLead,
    refreshLeads,
    reconcileSignUp,
  };
}
