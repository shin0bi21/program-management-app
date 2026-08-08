import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '../../../common/utils/clientErrors';
import { getPublicHomepageSessions } from '../api/homepage.api';

export function useHomepageSessions() {
  const query = useQuery({
    queryKey: ['homepage', 'public', 'sessions'],
    queryFn: ({ signal }) => getPublicHomepageSessions({ signal }),
  });

  return {
    sessions: query.data?.sessions ?? [],
    loading: query.isLoading || (query.isFetching && !query.data),
    error: query.error && !query.data ? getErrorMessage(query.error) : null,
    refresh: async () => { await query.refetch(); },
  };
}
