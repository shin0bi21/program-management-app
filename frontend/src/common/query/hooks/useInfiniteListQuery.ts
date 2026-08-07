import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type QueryFunctionContext,
  type QueryKey,
} from '@tanstack/react-query';
import type { CursorPage } from '../../types/pagination';
import { getErrorMessage } from '../../utils/clientErrors';
import upsertRow from '../utils/upsertRow';

interface InfiniteListQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: (context: QueryFunctionContext<QueryKey, string | null>) => Promise<CursorPage<T> | T[]>;
  errorMessage: string;
  enabled?: boolean;
}

export default function useInfiniteListQuery<T extends { id: string }>({
  queryKey,
  queryFn,
  errorMessage,
  enabled = true,
}: InfiniteListQueryOptions<T>) {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async context => {
      const result = await queryFn(context);
      return Array.isArray(result) ? { rows: result, nextCursor: null } : result;
    },
    enabled,
    placeholderData: keepPreviousData,
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const rows = query.data?.pages.flatMap(page => page.rows) ?? [];

  const updatePages = (update: (rows: T[]) => T[]) => {
    queryClient.setQueryData<InfiniteData<CursorPage<T>>>(queryKey, current => current && ({
      ...current,
      pages: current.pages.map((page, index) => index === 0
        ? { ...page, rows: update(current.pages.flatMap(item => item.rows)) }
        : { ...page, rows: [] }),
    }));
  };

  return {
    rows,
    loading: query.isLoading,
    refreshing: query.isFetching && !query.isFetchingNextPage && !query.isLoading,
    loadingNextPage: query.isFetchingNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    loadNextPage: () => { void query.fetchNextPage(); },
    error: query.error ? getErrorMessage(query.error, errorMessage) : '',
    refetch: async () => { await query.refetch(); },
    upsert: (row: T) => updatePages(current => upsertRow(current, row)),
    remove: (id: string) => updatePages(current => current.filter(row => row.id !== id)),
  };
}
