import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../common/components/Modal/hooks/useConfirmModal';
import { COHORT_QUERY_KEY } from '../../../../common/features/programming/queryKeys';
import { YOUTH_QUERY_KEY } from '../../../../common/features/youth/queryKeys';
import { deleteLead, updateLeadStatus } from '../leads.api';
import type { Lead, LeadStatus } from '../types';

export default function useLeadActions(listQueryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const refreshLeads = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: listQueryKey });
  }, [listQueryKey, queryClient]);

  const setStatus = useCallback(async (lead: Lead, status: LeadStatus) => {
    await updateLeadStatus(lead.id, status);
    await refreshLeads();
  }, [refreshLeads]);

  const requestDelete = useCallback((lead: Lead) => setConfirmAction({
    title: 'Delete Lead',
    message: `Delete ${lead.youthFirstName} ${lead.youthLastName} and all follow-up notes? This cannot be undone.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'Lead deleted',
    onConfirm: async () => { await deleteLead(lead.id); await refreshLeads(); },
  }), [refreshLeads]);

  const reconcileSignUp = useCallback(async () => {
    await Promise.all([
      refreshLeads(),
      queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
    ]);
  }, [queryClient, refreshLeads]);

  return {
    confirmAction,
    closeConfirmation: () => setConfirmAction(null),
    setStatus,
    requestDelete,
    refreshLeads,
    reconcileSignUp,
  };
}
