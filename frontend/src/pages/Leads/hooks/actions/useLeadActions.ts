import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../common/components/ConfirmModal/types';
import { deleteLead, updateLeadStatus, type LeadSignUpResult } from '../../leads.api';
import type { EditableLeadStatus, Lead } from '../../types';
import { updateProgramCycleAssignments } from '../../../Programming/Programs/hooks/actions/programCycleAssignmentCache';

const PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY = ['programs', 'cycle-assignments'] as const;
const YOUTH_TABLE_QUERY_KEY = ['youth', 'table'] as const;

interface UseLeadActionsOptions {
  tableQueryKey: readonly unknown[];
  onLeadRemoved?: (leadId: string) => void;
  onLeadSynced?: (lead: Lead) => void;
}

/**
 * Saves lead actions and invalidates affected queries.
 * @param options - Lead table scope and selected-row update callbacks.
 * @example actions.setStatus(lead, 'contacted') // refreshes loaded leads
 */
export default function useLeadActions({
  tableQueryKey,
  onLeadRemoved,
  onLeadSynced,
}: UseLeadActionsOptions) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionError, setActionError] = useState('');

  const refreshLeads = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: tableQueryKey });
  }, [tableQueryKey, queryClient]);

  const syncLead = useCallback((lead: Lead) => {
    setActionError('');
    onLeadSynced?.(lead);
    void refreshLeads();
  }, [onLeadSynced, refreshLeads]);

  const setStatus = useCallback(async (lead: Lead, status: EditableLeadStatus) => {
    setActionError('');

    try {
      const savedLead = await updateLeadStatus(lead.id, status);
      onLeadSynced?.(savedLead);
      await refreshLeads();
    } catch {
      setActionError('Unable to update lead status.');
    }
  }, [onLeadSynced, refreshLeads]);

  const requestDelete = useCallback((lead: Lead) => setConfirmAction({
    title: 'Delete Lead',
    message: `Delete ${lead.youthFirstName} ${lead.youthLastName} and all follow-up notes? This cannot be undone.`,
    confirmVariant: 'danger',
    successMessage: 'Lead deleted',
    onConfirm: async () => {
      await deleteLead(lead.id);
      onLeadRemoved?.(lead.id);
      await refreshLeads();
    },
  }), [onLeadRemoved, refreshLeads]);

  const reconcileSignUp = useCallback(async (saved: LeadSignUpResult) => {
    setActionError('');
    onLeadSynced?.(saved.lead);
    if (saved.updatedProgramCycle) {
      updateProgramCycleAssignments(queryClient, [saved.updatedProgramCycle]);
    }
    await Promise.all([
      refreshLeads(),
      queryClient.invalidateQueries({ queryKey: YOUTH_TABLE_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY }),
    ]);
  }, [onLeadSynced, queryClient, refreshLeads]);

  return {
    confirmAction,
    actionError,
    closeConfirmation: () => setConfirmAction(null),
    requestDelete,
    setStatus,
    syncLead,
    reconcileSignUp,
  };
}
