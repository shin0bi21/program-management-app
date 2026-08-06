import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getYouth } from '../../../common/api/youth.api';
import { getErrorMessage } from '../../../common/utils/clientErrors';
import upsertRow from '../../../common/utils/upsertRow';
import type { YouthProfile } from '../types';
import type { YouthFilters } from '../../../common/types/youth';

export type { YouthProfile };

export function useYouth(filters: YouthFilters | null = {}) {
  const queryClient = useQueryClient();
  const queryKey = ['youth', filters] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getYouth(undefined, filters ?? {}, { signal }),
    enabled: filters !== null,
  });

  const upsertYouth = (savedYouth: YouthProfile) => {
    queryClient.setQueryData<YouthProfile[]>(queryKey, current => (
      upsertRow(current ?? [], savedYouth)
    ));
  };

  const removeYouth = (id: string) => {
    queryClient.setQueryData<YouthProfile[]>(queryKey, current => (
      current?.filter(youth => youth.id !== id) ?? []
    ));
  };

  const refetch = async () => {
    await query.refetch();
  };

  return {
    youth: query.data ?? [],
    upsertYouth,
    removeYouth,
    loading: query.isLoading,
    error: query.error ? getErrorMessage(query.error, 'Failed to load youth profiles') : '',
    refetch,
  };
}
