import { useQuery } from '@tanstack/react-query';
import { getSessionTypes } from '../../../../common/features/programming/api/programming.api';
import type { SessionType } from '../../../../common/types/cohort';

export function useSessionTypes() {
  const query = useQuery<SessionType[]>({
    queryKey: ['session-types'],
    queryFn: ({ signal }) => getSessionTypes({ signal }),
  });

  return query.data ?? [];
}
