import { useCallback, useEffect, useState } from 'react';
import type { Lead } from '../../types';

/**
 * Retains selection across table filters while resolving the latest saved lead.
 * @param records - Current saved leads supplied by the page data owner.
 * @example selection.selectLead(row) // dashboard follows subsequent owner updates
 */
export default function useLeadSelection(records: Readonly<Record<string, Lead>>) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLeadId && !records[selectedLeadId]) setSelectedLeadId(null);
  }, [records, selectedLeadId]);

  const selectLead = useCallback((lead: Lead | null) => setSelectedLeadId(lead?.id ?? null), []);
  const removeSelectedLead = useCallback((leadId: string) => {
    setSelectedLeadId(current => current === leadId ? null : current);
  }, []);

  return {
    selectedLead: selectedLeadId ? records[selectedLeadId] ?? null : null,
    selectedLeadId,
    selectLead,
    removeSelectedLead,
  };
}
