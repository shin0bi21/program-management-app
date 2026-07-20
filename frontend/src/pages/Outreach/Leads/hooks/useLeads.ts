import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import { getLeads } from '../api/leads.api';
import type { Lead } from '../types';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLeads(await getLeads());
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load leads'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { leads, setLeads, loading, error, reload: load };
}
