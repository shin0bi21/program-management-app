import { useQuery } from '@tanstack/react-query';
import { getSessionTypes } from '../../sessions.api';
import type { SessionType } from '../../types';

export function useSessionTypes() {
  const query = useQuery<SessionType[]>({
    queryKey: ['session-types'],
    queryFn: ({ signal }) => getSessionTypes({ signal }),
  });

  return {
    sessionTypes: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? 'Could not load session types.' : null,
  };
}
