import {
  hashKey,
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
  type QueryFunctionContext,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useSyncExternalStore, useRef, useLayoutEffect } from 'react';
import type { CursorPage } from '../types';
import type { ListOrdering } from '../listOrdering';
import {
  registerInfiniteListQuery, reconcileInfiniteListData, reconcileInfiniteListRead,
  subscribeInfiniteListView, getInfiniteListViewState, refreshInfiniteListView,
} from '../infiniteListCache';
import { getErrorMessage } from '../../http/errors';

interface InfiniteListQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: (context: QueryFunctionContext<QueryKey, string | null>) => Promise<CursorPage<T>>;
  errorMessage: string;
  enabled?: boolean;
  ordering?: ListOrdering<T>;
}

export interface InfiniteListRefreshNotice {
  refreshing: boolean;
  onRefresh: () => void;
}

interface InfiniteListQueryResult<T> {
  rows: T[];
  loading: boolean;
  refreshing: boolean;
  loadingNextPage: boolean;
  hasNextPage: boolean;
  loadNextPage: () => void;
  retryNextPage: () => void;
  nextPageError: string;
  retry: () => void;
  error: string;
  refreshNotice?: InfiniteListRefreshNotice;
}

export default function useInfiniteListQuery<T extends { id: string }>({
  queryKey,
  queryFn,
  errorMessage,
  enabled = true,
  ordering,
}: InfiniteListQueryOptions<T>): InfiniteListQueryResult<T> {
  const queryClient = useQueryClient();
  const queryIdentity = hashKey(queryKey);
  const refreshOptionsRef = useRef({ queryKey, queryFn, queryIdentity });
  useLayoutEffect(() => { refreshOptionsRef.current = { queryKey, queryFn, queryIdentity }; }, [queryFn, queryIdentity, queryKey]);
  useEffect(() => {
    registerInfiniteListQuery(queryClient, queryKey, { ordering });
  }, [ordering, queryClient, queryKey]);
  const query = useInfiniteQuery({
    queryKey,
    queryFn: context => reconcileInfiniteListRead(queryClient, context.queryKey, () => queryFn(context)),
    enabled,
    structuralSharing: (previous, incoming) => reconcileInfiniteListData<T>(queryClient, queryKey, previous, incoming),
    placeholderData: keepPreviousData,
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const subscribeToView = useCallback((listener: () => void) => (
    subscribeInfiniteListView(queryClient, queryKey, listener)
  ), [queryClient, queryKey]);
  const getViewState = useCallback(() => getInfiniteListViewState(queryClient, queryKey), [queryClient, queryKey]);
  const viewState = useSyncExternalStore(subscribeToView, getViewState, getViewState);
  const refreshView = useCallback(() => {
    const options = refreshOptionsRef.current;
    if (options.queryIdentity !== queryIdentity) return;

    const { queryKey: refreshKey, queryFn: loadPage } = options;
    void refreshInfiniteListView(queryClient, refreshKey, async () => {
      await queryClient.cancelQueries({ queryKey: refreshKey, exact: true });
      await queryClient.fetchInfiniteQuery({
        queryKey: refreshKey,
        queryFn: context => reconcileInfiniteListRead(queryClient, context.queryKey, () => loadPage(context)),
        initialPageParam: null as string | null,
        getNextPageParam: page => page.nextCursor ?? undefined,
        pages: 1,
        staleTime: 0,
        structuralSharing: (previous, incoming) => reconcileInfiniteListData<T>(queryClient, refreshKey, previous, incoming),
      });
    }).catch(() => undefined);
  }, [queryClient, queryIdentity]);
  const refreshNotice = useMemo<InfiniteListRefreshNotice | undefined>(() => viewState === 'current'
    ? undefined
    : { refreshing: viewState === 'refreshing', onRefresh: refreshView }, [refreshView, viewState]);
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
    refreshNotice,
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
