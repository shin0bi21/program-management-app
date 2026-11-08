import { useQuery } from '@tanstack/react-query';
import { getYouthProfileNotes } from '../../../../youth.api';
import { profileNotesQueryKey } from '../../../ProfileNotes/useProfileNotes';

/**
 * Loads saved profile notes for the youth selected in the Notes card.
 * @param youthId - Selected youth ID; null disables the request.
 * @example useYouthProfileNotesData('youth-1') // notes and request feedback for youth-1
 */
export default function useYouthProfileNotesData(youthId: string | null) {
  const query = useQuery({
    queryKey: profileNotesQueryKey(youthId),
    queryFn: ({ signal }) => {
      if (!youthId) throw new Error('A selected youth profile is required to load profile notes');
      return getYouthProfileNotes(youthId, { signal });
    },
    enabled: youthId !== null,
  });

  return {
    notes: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? 'Could not load profile notes' : null,
    retry: query.refetch,
  };
}
