import {
  keepPreviousData,
  useInfiniteQuery,
  type QueryFunctionContext,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import type { CursorPage } from '../../common/types/pagination';
import { getErrorMessage } from '../../http/errors';

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
  const rows = [...new Map(
    (query.data?.pages.flatMap(page => page.rows) ?? []).map(row => [row.id, row]),
  ).values()];
  const retry = useCallback(() => { void query.refetch(); }, [query.refetch]);

  return {
    rows,
    loading: query.isLoading,
    refreshing: query.isFetching && !query.isFetchingNextPage && !query.isLoading,
    loadingNextPage: query.isFetchingNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    loadNextPage: () => { void query.fetchNextPage(); },
    retry,
    error: query.error ? getErrorMessage(query.error, errorMessage) : '',
  };
}
