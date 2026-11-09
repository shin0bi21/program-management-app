import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../query/infiniteListCache';
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
 * Updates saved lead rows and refreshes related signup data.
 * @param options - Lead table scope and selected-row update callbacks.
 * @example actions.setStatus(lead, 'contacted') // updates the loaded lead row
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

  const syncLead = useCallback((lead: Lead, operation: 'create' | 'update' = 'update') => {
    setActionError('');
    onLeadSynced?.(lead);
    if (operation === 'create') {
      void refreshLeads();
    } else {
      replaceInfiniteListRow(queryClient, tableQueryKey, lead);
    }
  }, [onLeadSynced, queryClient, refreshLeads, tableQueryKey]);

  const setStatus = useCallback(async (lead: Lead, status: EditableLeadStatus) => {
    setActionError('');

    try {
      const savedLead = await updateLeadStatus(lead.id, status);
      syncLead(savedLead);
    } catch {
      setActionError('Unable to update lead status.');
    }
  }, [syncLead]);

  const requestDelete = useCallback((lead: Lead) => setConfirmAction({
    title: 'Delete Lead',
    message: `Delete ${lead.youthFirstName} ${lead.youthLastName} and all follow-up notes? This cannot be undone.`,
    confirmVariant: 'danger',
    successMessage: 'Lead deleted',
    onConfirm: async () => {
      await deleteLead(lead.id);
      removeInfiniteListRow(queryClient, tableQueryKey, lead.id);
      onLeadRemoved?.(lead.id);
    },
  }), [onLeadRemoved, queryClient, tableQueryKey]);

  const reconcileSignUp = useCallback(async (saved: LeadSignUpResult) => {
    setActionError('');
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
    reconcileSignUp,
  };
}
