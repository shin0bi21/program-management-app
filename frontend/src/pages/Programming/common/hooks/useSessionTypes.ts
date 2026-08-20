import { useQuery } from '@tanstack/react-query';
import { getSessionTypes } from '../../../../common/features/programming/api/sessions.api';
import type { SessionType } from '../../../../common/types/cohort';

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
