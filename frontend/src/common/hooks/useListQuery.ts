import {
  useQuery,
  useQueryClient,
  type QueryKey,
  type QueryFunctionContext,
} from '@tanstack/react-query';
import { getErrorMessage } from '../utils/clientErrors';
import upsertRow from '../utils/upsertRow';

interface ListQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: (context: QueryFunctionContext) => Promise<T[]>;
  errorMessage: string;
  enabled?: boolean;
}

export default function useListQuery<T extends { id: string }>({
  queryKey,
  queryFn,
  errorMessage,
  enabled = true,
}: ListQueryOptions<T>) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey, queryFn, enabled });

  const upsert = (row: T) => {
    queryClient.setQueryData<T[]>(queryKey, current => upsertRow(current ?? [], row));
  };

  const remove = (id: string) => {
    queryClient.setQueryData<T[]>(queryKey, current => (
      current?.filter(row => row.id !== id) ?? []
    ));
  };

  const refetch = async () => {
    await query.refetch();
  };

  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? getErrorMessage(query.error, errorMessage) : '',
    refetch,
    upsert,
    remove,
  };
}
