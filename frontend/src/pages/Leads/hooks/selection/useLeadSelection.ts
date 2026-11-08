import { useCallback, useState } from 'react';
import type { Lead } from '../../types';

/**
 * Keeps the clicked lead as dashboard context across table filters.
 * @example selection.selectLead(row) // dashboard requests use row.id
 */
export default function useLeadSelection() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const selectLead = useCallback((lead: Lead | null) => setSelectedLead(lead), []);
  const updateSelectedLead = useCallback((lead: Lead) => {
    setSelectedLead(current => current?.id === lead.id ? lead : current);
  }, []);
  const removeSelectedLead = useCallback((leadId: string) => {
    setSelectedLead(current => current?.id === leadId ? null : current);
  }, []);

  return {
    selectedLead,
    selectedLeadId: selectedLead?.id ?? null,
    selectLead,
    updateSelectedLead,
    removeSelectedLead,
  };
}
