import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import { getLeads } from '../api/leads.api';
import type { Lead, LeadFilters } from '../types';

export function useLeads(filters: LeadFilters) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const nextLeads = await getLeads(filters);
      if (currentRequest === requestId.current) setLeads(nextLeads);
    } catch (err) {
      if (currentRequest === requestId.current) setError(getErrorMessage(err, 'Failed to load leads'));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [filters.search, filters.statuses]);

  useEffect(() => { void load(); }, [load]);
  return { leads, setLeads, loading, error, reload: load };
}
