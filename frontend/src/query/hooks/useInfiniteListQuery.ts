import {
  keepPreviousData,
  useInfiniteQuery,
  type QueryFunctionContext,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { CursorPage } from '../types';
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
  const rows = useMemo(() => [...new Map(
    (query.data?.pages.flatMap(page => page.rows) ?? []).map(row => [row.id, row]),
  ).values()], [query.data]);
  const { refetch, fetchNextPage } = query;
  const nextPageError = query.isFetchNextPageError && query.error
    ? getErrorMessage(query.error, errorMessage)
    : '';
  const loadNextPage = useCallback(() => {
    if (!enabled || !query.hasNextPage || query.isFetching || query.isError) return;
    void fetchNextPage();
  }, [enabled, fetchNextPage, query.hasNextPage, query.isFetching, query.isError]);
  const retryNextPage = useCallback(() => {
    if (!enabled || !query.hasNextPage || query.isFetching) return;
    void fetchNextPage();
  }, [enabled, fetchNextPage, query.hasNextPage, query.isFetching]);
  const retry = useCallback(() => { void refetch(); }, [refetch]);

  return {
    rows,
    loading: query.isLoading,
    refreshing: query.isFetching && !query.isFetchingNextPage && !query.isLoading,
    loadingNextPage: query.isFetchingNextPage,
    hasNextPage: enabled && Boolean(query.hasNextPage) && !query.isError,
    loadNextPage,
    retryNextPage,
    nextPageError,
    retry,
    error: query.error && !query.isFetchNextPageError ? getErrorMessage(query.error, errorMessage) : '',
  };
}
