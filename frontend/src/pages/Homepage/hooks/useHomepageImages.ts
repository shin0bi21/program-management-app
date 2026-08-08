import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '../../../common/utils/clientErrors';
import { getPublicHomepageImages } from '../api/homepage.api';

export function useHomepageImages() {
  const query = useQuery({
    queryKey: ['homepage', 'public', 'images'],
    queryFn: ({ signal }) => getPublicHomepageImages({ signal }),
  });

  return {
    images: query.data?.images ?? [],
    loading: query.isLoading || (query.isFetching && !query.data),
    error: query.error && !query.data ? getErrorMessage(query.error) : null,
    refresh: async () => { await query.refetch(); },
  };
}
