import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '../../../../http/errors';
import { getPublicHomepagePrograms } from '../publicHomepage.api';

export function useHomepagePrograms() {
  const query = useQuery({
    queryKey: ['homepage', 'public', 'programs'],
    queryFn: ({ signal }) => getPublicHomepagePrograms({ signal }),
  });

  return {
    programs: query.data?.programs ?? [],
    loading: query.isLoading || (query.isFetching && !query.data),
    error: query.error && !query.data ? getErrorMessage(query.error) : null,
    refresh: async () => { await query.refetch(); },
  };
}
