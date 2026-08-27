import { useCallback, useState } from 'react';

import type { Lead } from '../../types';

export default function useLeadSelection() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const syncSelectedLead = useCallback((lead: Lead) => {
    setSelectedLead(current => current?.id === lead.id ? lead : current);
  }, []);

  const removeSelectedLead = useCallback((leadId: string) => {
    setSelectedLead(current => current?.id === leadId ? null : current);
  }, []);

  return {
    selectedLead,
    selectedLeadId: selectedLead?.id ?? null,
    selectLead: setSelectedLead,
    syncSelectedLead,
    removeSelectedLead,
  };
}
