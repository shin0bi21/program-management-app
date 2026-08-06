import useListQuery from '../../../../common/hooks/useListQuery';
import { getLeads } from '../api/leads.api';
import type { Lead, LeadFilters } from '../types';

export function useLeads(filters: LeadFilters | null) {
  const query = useListQuery<Lead>({
    queryKey: ['leads', filters],
    queryFn: ({ signal }) => getLeads(filters ?? {}, { signal }),
    errorMessage: 'Failed to load leads',
    enabled: filters !== null,
  });

  return {
    leads: query.rows,
    upsertLead: query.upsert,
    removeLead: query.remove,
    loading: query.loading,
    error: query.error,
    reload: query.refetch,
  };
}
