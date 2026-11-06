import {
  hashKey,
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryFunctionContext,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useSyncExternalStore, useRef, useLayoutEffect } from 'react';
import type { CursorPage } from '../types';
import type { ListOrdering } from '../listOrdering';
import {
  registerInfiniteListQuery,
  reconcileInfiniteListData,
  reconcileInfiniteListRead,
  subscribeInfiniteListView,
  getInfiniteListViewState,
  refreshInfiniteListView,
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

/**
 * Supplies a table's loaded rows, fetching another page as the user scrolls.
 * @param options.queryKey - Identifies the list and its search, filters, and sorting,
 * e.g. ['tasks', 'table', filters, sorting].
 * @param options.queryFn - Fetches one page using its cursor and cancellation signal;
 * returns { rows, nextCursor }. Forward the signal to the API adapter.
 * @param options.enabled - Whether loading may start, e.g. after saved filters are ready.
 * @param options.errorMessage - Fallback text when a page cannot load.
 * @param options.ordering - How to read and compare each row's sort value after an edit.
 * @returns Loaded rows, loading/error states, and load/retry actions. refreshNotice offers
 * a first-page refresh when an edited row no longer fits its position; edits stay in place.
 * @example Loading 50 rows then calling loadNextPage adds the next 50, producing 100 rows.
 */
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

  useLayoutEffect(() => {
    refreshOptionsRef.current = { queryKey, queryFn, queryIdentity };
  }, [queryFn, queryIdentity, queryKey]);
  useEffect(() => {
    registerInfiniteListQuery(queryClient, queryKey, { ordering });
  }, [ordering, queryClient, queryKey]);

  const query = useInfiniteQuery({
    ...createInfiniteListQueryOptions(queryClient, queryKey, queryFn),
    enabled,
    placeholderData: keepPreviousData,
  });

  /**
   * Calls the listener when edits change this list's order warning or refresh state.
   * @param listener - Requests another snapshot when this exact list changes.
   * @returns A cleanup function that removes this listener.
   * @example Editing a sort value can notify a second observer of the same query.
   */
  const subscribeToView = useCallback((listener: () => void) => (
    subscribeInfiniteListView(queryClient, queryKey, listener)
  ), [queryClient, queryKey]);

  /**
   * Reports whether edited rows fit their positions or need a refresh.
   * @returns 'current' when no misplaced edit is detected, 'retained' for misplaced edits, or
   * 'refreshing' while those edits await a first-page refresh.
   * @example A misplaced edited row produces 'retained' until refresh or correction.
   */
  const getViewState = useCallback(() => getInfiniteListViewState(queryClient, queryKey), [queryClient, queryKey]);
  const viewState = useSyncExternalStore(subscribeToView, getViewState, getViewState);

  /**
   * Replaces loaded rows with a fresh first page, keeping existing rows if loading fails.
   * Cancels the exact list's pending fetch; failures appear through the hook's error state.
   * @example Refreshing a 100-row list successfully replaces it with the first 50 fresh rows.
   */
  const refreshView = useCallback(() => {
    const options = refreshOptionsRef.current;
    if (options.queryIdentity !== queryIdentity) return;

    const { queryKey: refreshKey, queryFn: loadPage } = options;
    void refreshInfiniteListView(queryClient, refreshKey, async () => {
      await queryClient.cancelQueries({ queryKey: refreshKey, exact: true });
      await queryClient.fetchInfiniteQuery({
        ...createInfiniteListQueryOptions(queryClient, refreshKey, loadPage),
        pages: 1,
        staleTime: 0,
      });
    }).catch(() => undefined);
  }, [queryClient, queryIdentity]);
  const refreshNotice = useMemo<InfiniteListRefreshNotice | undefined>(() => viewState === 'current'
    ? undefined
    : { refreshing: viewState === 'refreshing', onRefresh: refreshView }, [refreshView, viewState]);
  const rows = useMemo(() => getLoadedRows(query.data), [query.data]);
  const { refetch, fetchNextPage } = query;
  const nextPageError = query.isFetchNextPageError && query.error
    ? getErrorMessage(query.error, errorMessage)
    : '';

  /**
   * Fetches the next page when loading is enabled and no request or failure blocks it.
   * @example A sentinel event while isFetching is true skips loading another page.
   */
  const loadNextPage = useCallback(() => {
    if (!enabled || !query.hasNextPage || query.isFetching || query.isError) return;
    void fetchNextPage();
  }, [enabled, fetchNextPage, query.hasNextPage, query.isFetching, query.isError]);

  /**
   * Retries a failed next page while keeping already loaded rows visible.
   * @example Retry after a failed second page keeps the already loaded first page visible.
   */
  const retryNextPage = useCallback(() => {
    if (!enabled || !query.hasNextPage || query.isFetching) return;
    void fetchNextPage();
  }, [enabled, fetchNextPage, query.hasNextPage, query.isFetching]);

  /**
   * Reloads the collection and exposes its result through the returned data/error state.
   * @example Retry after an initial failure requests the collection again.
   */
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

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

/**
 * Configures cursor loading so normal requests and first-page refreshes preserve concurrent edits.
 * @param queryClient - Owns the list cache and concurrent edit tracking.
 * @param queryKey - The list and its filters/sorting.
 * @param queryFn - Loads one cursor page; no request runs until the returned queryFn is called.
 * @returns Shared cursor and reconciliation options; request failures propagate to TanStack Query.
 * @example Both loading paths start with a null cursor and reconcile saved rows before displaying them.
 */
function createInfiniteListQueryOptions<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  queryFn: InfiniteListQueryOptions<T>['queryFn'],
) {
  return {
    queryKey,
    /**
     * Loads one cursor page while tracking edits that arrive before it completes.
     * @param context - TanStack request identity, page cursor, and cancellation signal.
     * @returns The requested page, or the loader's rejection.
     * @example A null pageParam requests the first page using context.signal.
     */
    queryFn: (context: QueryFunctionContext<QueryKey, string | null>) => (
      reconcileInfiniteListRead(queryClient, context.queryKey, () => queryFn(context))
    ),
    initialPageParam: null as string | null,
    /**
     * Supplies the cursor for the following page, or ends pagination.
     * @param page - The last page returned by the API.
     * @example A page with nextCursor: null returns undefined.
     */
    getNextPageParam: (page: CursorPage<T>) => page.nextCursor ?? undefined,
    /**
     * Preserves edits received during loading and reuses unchanged cached values.
     * @param previous - Cached infinite-page data before this result arrived.
     * @param incoming - Fetched infinite-page data to reconcile with saved changes.
     * @example A row saved during loading replaces its older value in incoming pages.
     */
    structuralSharing: (previous: unknown, incoming: unknown) => (
      reconcileInfiniteListData<T>(queryClient, queryKey, previous, incoming)
    ),
  };
}

/**
 * Combines loaded pages into one row per ID, keeping its first position and last received value.
 * @param data - Loaded cursor pages, or undefined before data is available.
 * @example Pages [A, B] and [updated A, C] produce [updated A, B, C].
 */
function getLoadedRows<T extends { id: string }>(data: InfiniteData<CursorPage<T>> | undefined): T[] {
  const rows = data?.pages.flatMap(page => page.rows) ?? [];
  return [...new Map(rows.map(row => [row.id, row])).values()];
}
