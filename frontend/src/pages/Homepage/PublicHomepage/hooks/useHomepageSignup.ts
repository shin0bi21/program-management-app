import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '../../../../http/errors';
import { getPublicHomepageSignup } from '../publicHomepage.api';

export function useHomepageSignup() {
  const query = useQuery({
    queryKey: ['homepage', 'public', 'signup'],
    queryFn: ({ signal }) => getPublicHomepageSignup({ signal }),
  });

  return {
    signupEnabled: query.data?.signupEnabled ?? false,
    loading: query.isLoading,
    error: query.error && !query.data ? getErrorMessage(query.error) : null,
    refresh: async () => { await query.refetch(); },
  };
}
