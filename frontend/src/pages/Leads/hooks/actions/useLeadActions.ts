import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../common/components/ConfirmModal/types';
import { leadData } from '../data/useLeadData';
import { deleteLead, updateLeadStatus, type LeadSignUpResult } from '../../leads.api';
import type { EditableLeadStatus, Lead } from '../../types';

import { updateProgramCycleAssignments } from '../../../Programming/Programs/hooks/actions/programCycleAssignmentCache';
const PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY = ['programs', 'cycle-assignments'] as const;
const YOUTH_TABLE_QUERY_KEY = ['youth', 'table'] as const;

interface UseLeadActionsOptions {
  tableQueryKey: readonly unknown[];
  onLeadRemoved?: (leadId: string) => void;
}

/**
 * Publishes saved lead actions to the shared owner and reconciles affected lists.
 * @example actions.setStatus(lead, 'contacted') // updates every loaded view
 */
export default function useLeadActions({
  tableQueryKey,
  onLeadRemoved,
}: UseLeadActionsOptions) {
  const queryClient = useQueryClient();
  const scope = leadData.getScope(queryClient);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionError, setActionError] = useState('');
  const actionGenerations = useRef(new Map<string, number>());

  /**
   * Starts a newer action for this lead so older completions cannot replace it.
   * @param leadId - Saved lead being changed.
   * @example nextActionGeneration('lead-1') // advances that lead's action counter
   */
  const nextActionGeneration = useCallback((leadId: string) => {
    const generation = (actionGenerations.current.get(leadId) ?? 0) + 1;
    actionGenerations.current.set(leadId, generation);
    return generation;
  }, []);

  /**
   * Checks whether this completion still belongs to the current account and latest lead action.
   * @param leadId - Lead changed by the completing request.
   * @param generation - Counter captured before starting that request.
   * @example isCurrentAction('lead-1', generation) // false after a newer action starts
   */
  const isCurrentAction = useCallback(
    (leadId: string, generation: number) => leadData.isScope(queryClient, scope) && actionGenerations.current.get(leadId) === generation,
    [queryClient, scope],
  );

  const refreshLeads = useCallback(async () => {
    if (!leadData.isScope(queryClient, scope)) return;
    await queryClient.invalidateQueries({ queryKey: tableQueryKey });
  }, [tableQueryKey, queryClient, scope]);

  const applyLead = useCallback((lead: Lead) => {
    if (!leadData.isScope(queryClient, scope)) return;
    leadData.write(queryClient, lead);
  }, [queryClient, scope]);

  const syncLead = useCallback((lead: Lead) => {
    setActionError('');
    nextActionGeneration(lead.id);
    applyLead(lead);
    leadData.setPending(queryClient, lead.id, false, scope);
  }, [applyLead, nextActionGeneration, queryClient, scope]);

  const setStatus = useCallback(async (lead: Lead, status: EditableLeadStatus) => {
    setActionError('');
    const generation = nextActionGeneration(lead.id);
    leadData.setPending(queryClient, lead.id, true, scope);

    try {
      const savedLead = await updateLeadStatus(lead.id, status);
      if (isCurrentAction(lead.id, generation)) applyLead(savedLead);
    } catch {
      if (isCurrentAction(lead.id, generation)) setActionError('Unable to update lead status.');
    } finally {
      if (isCurrentAction(lead.id, generation)) leadData.setPending(queryClient, lead.id, false, scope);
    }
  }, [applyLead, isCurrentAction, nextActionGeneration, queryClient, scope]);

  const requestDelete = useCallback((lead: Lead) => setConfirmAction({
    title: 'Delete Lead',
    message: `Delete ${lead.youthFirstName} ${lead.youthLastName} and all follow-up notes? This cannot be undone.`,
    confirmVariant: 'danger',
    successMessage: 'Lead deleted',
    onConfirm: async () => {
      const generation = nextActionGeneration(lead.id);
      leadData.setPending(queryClient, lead.id, true, scope);
      try {
        await deleteLead(lead.id);
        if (!isCurrentAction(lead.id, generation)) return;
        leadData.remove(queryClient, lead.id);
        onLeadRemoved?.(lead.id);
      } finally {
        if (isCurrentAction(lead.id, generation)) leadData.setPending(queryClient, lead.id, false, scope);
      }
    },
  }), [isCurrentAction, nextActionGeneration, onLeadRemoved, queryClient, scope]);

  const reconcileSignUp = useCallback(async (saved: LeadSignUpResult) => {
    if (!leadData.isScope(queryClient, scope)) return;
    syncLead(saved.lead);
    if (saved.updatedProgramCycle) {
      updateProgramCycleAssignments(queryClient, [saved.updatedProgramCycle]);
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: YOUTH_TABLE_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY }),
    ]);
  }, [queryClient, scope, syncLead]);

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
