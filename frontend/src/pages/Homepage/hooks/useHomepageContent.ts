import { useQuery } from '@tanstack/react-query';
import { getPublicHomepage, type HomepageContent } from '../api/homepage.api';
import { getErrorMessage } from '../../../common/utils/clientErrors';

export function useHomepageContent() {
  const query = useQuery<HomepageContent>({
    queryKey: ['homepage', 'public'],
    queryFn: ({ signal }) => getPublicHomepage({ signal }),
  });

  return {
    content: query.data ?? { images: [], sessions: [] },
    loading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    refresh: async () => { await query.refetch(); },
  };
}
