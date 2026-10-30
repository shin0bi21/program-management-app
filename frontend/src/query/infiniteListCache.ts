import { hashKey, replaceEqualDeep, type InfiniteData, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { CursorPage } from './types';
import { compareListSortValues, hasMisplacedListRows, type ListOrdering } from './listOrdering';

type InfiniteListData<T> = InfiniteData<CursorPage<T>>;
type CachedRow = { id: string };
type ListMutation = { type: 'replace'; row: CachedRow; revision: number } | { type: 'remove'; id: string };
interface PendingRead {
  mutations: ListMutation[];
  initialViewRevision: number;
  resetsView: boolean;
}
interface RegisteredQuery {
  ordering?: ListOrdering<CachedRow>;
  editedSortIds: Set<string>;
  viewRevision: number;
  refresh?: Promise<void>;
  refreshViewRevision?: number;
}
interface ReadTracker {
  reads: Map<string, PendingRead>;
  registered: Map<string, RegisteredQuery>;
  revision: number;
}
const pendingReads = new WeakMap<QueryClient, ReadTracker>();
const viewListeners = new WeakMap<QueryClient, Map<string, Set<() => void>>>();

function listQueryHash(queryClient: QueryClient, queryKey: QueryKey) {
  return queryClient.getQueryCache().find({ queryKey, exact: true })?.queryHash ?? hashKey(queryKey);
}

/** The query cache owns tracking lifetime, including fetches paused before their query function runs. */
export function registerInfiniteListQuery<T extends CachedRow>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  options?: { ordering?: ListOrdering<T> },
) {
  let tracker = pendingReads.get(queryClient);
  if (!tracker) {
    const reads = new Map<string, PendingRead>();
    const registered = new Map<string, RegisteredQuery>();
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      const queryHash = event.query.queryHash;
      const registration = registered.get(queryHash);
      if (event.type === 'updated' && event.action.type === 'fetch' && registration) {
        reads.set(queryHash, {
          mutations: [],
          initialViewRevision: registration.refreshViewRevision ?? registration.viewRevision,
          resetsView: !event.query.state.fetchMeta?.fetchMore,
        });
      }
      const successfulFetch = event.type === 'updated' && event.action.type === 'success' && !event.action.manual;
      const fetchFinished = event.type === 'updated' && (
        successfulFetch || event.action.type === 'error'
        || (event.action.type === 'setState' && event.query.state.fetchStatus === 'idle')
      );
      const read = reads.get(queryHash);
      if (successfulFetch && read?.resetsView && registration
        && registration.viewRevision <= read.initialViewRevision) {
        registration.viewRevision = 0;
        registration.editedSortIds.clear();
      }
      if (fetchFinished) reads.delete(queryHash);
      if (event.type === 'updated' && event.action.type === 'success') notifyViewListeners(queryClient, queryHash);
      if (event.type === 'removed') {
        reads.delete(queryHash);
        registered.delete(queryHash);
        notifyViewListeners(queryClient, queryHash);
      }
      if (!registered.size) {
        unsubscribe();
        pendingReads.delete(queryClient);
      }
    });
    tracker = { reads, registered, revision: 0 };
    pendingReads.set(queryClient, tracker);
  }

  const queryHash = listQueryHash(queryClient, queryKey);
  let registration = tracker.registered.get(queryHash);
  if (!registration) {
    registration = { viewRevision: 0, editedSortIds: new Set() };
    tracker.registered.set(queryHash, registration);
  }
  if (options) {
    const ordering = options.ordering;
    registration.ordering = ordering ? { ...ordering, getValue: row => ordering.getValue(row as T) } : undefined;
  }
  const state = queryClient.getQueryState(queryKey);
  if (state && state.fetchStatus !== 'idle' && !tracker.reads.has(queryHash)) {
    tracker.reads.set(queryHash, {
      mutations: [],
      initialViewRevision: registration.refreshViewRevision ?? registration.viewRevision,
      resetsView: !state.fetchMeta?.fetchMore,
    });
  }
}

export function subscribeInfiniteListView(queryClient: QueryClient, queryKey: QueryKey, listener: () => void) {
  const queryHash = listQueryHash(queryClient, queryKey);
  let queries = viewListeners.get(queryClient);
  if (!queries) {
    queries = new Map();
    viewListeners.set(queryClient, queries);
  }
  const listeners = queries.get(queryHash) ?? new Set<() => void>();
  queries.set(queryHash, listeners);
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (!listeners.size) queries.delete(queryHash);
    if (!queries.size) viewListeners.delete(queryClient);
  };
}

export function getInfiniteListViewState(queryClient: QueryClient, queryKey: QueryKey) {
  const registration = pendingReads.get(queryClient)?.registered.get(listQueryHash(queryClient, queryKey));
  if (!registration?.ordering || !registration.editedSortIds.size) return 'current';

  const data = queryClient.getQueryData<InfiniteListData<CachedRow>>(queryKey);
  const rows = [...new Map((data?.pages.flatMap(page => page.rows) ?? []).map(row => [row.id, row])).values()];
  if (!hasMisplacedListRows(rows, registration.editedSortIds, registration.ordering)) return 'current';
  return registration.refresh ? 'refreshing' : 'retained';
}

/** Shares a refresh lock between observers of the same exact collection. */
export function refreshInfiniteListView(queryClient: QueryClient, queryKey: QueryKey, refresh: () => Promise<unknown>) {
  registerInfiniteListQuery(queryClient, queryKey);
  const queryHash = listQueryHash(queryClient, queryKey);
  const registration = pendingReads.get(queryClient)!.registered.get(queryHash)!;
  if (registration.refresh) return registration.refresh;

  const pending = Promise.resolve().then(refresh).then(() => undefined).finally(() => {
    registration.refresh = undefined;
    registration.refreshViewRevision = undefined;
    notifyViewListeners(queryClient, queryHash);
  });
  registration.refreshViewRevision = registration.viewRevision;
  registration.refresh = pending;
  notifyViewListeners(queryClient, queryHash);
  return pending;
}

/** Tracks the complete infinite fetch, including all pages in a sequential refetch. */
export function reconcileInfiniteListRead<T extends CachedRow>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  load: () => Promise<CursorPage<T>>,
): Promise<CursorPage<T>> {
  registerInfiniteListQuery(queryClient, queryKey);
  return load();
}

/** Replays pending writes across the whole result before TanStack publishes any fetched pages. */
export function reconcileInfiniteListData<T extends CachedRow>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  previous: unknown,
  incoming: unknown,
): InfiniteListData<T> {
  const data = incoming as InfiniteListData<T>;
  const queryHash = listQueryHash(queryClient, queryKey);
  const tracker = pendingReads.get(queryClient);
  const read = tracker?.reads.get(queryHash);
  if (!read?.mutations.length) return replaceEqualDeep(previous, data);

  const pages = data.pages.map(page => {
    let rows = page.rows;
    for (const mutation of read.mutations) {
      if (mutation.type === 'remove') {
        rows = rows.filter(row => row.id !== mutation.id);
      } else {
        // A query prefix has one row contract, shared by its reader and mutation owners.
        const saved = mutation.row as T;
        rows = rows.map(row => {
          if (row.id !== saved.id) return row;
          markViewChange(tracker?.registered.get(queryHash), row, saved, mutation.revision);
          return saved;
        });
      }
    }
    return { ...page, rows };
  });
  return replaceEqualDeep(previous, { ...data, pages });
}

function notifyViewListeners(queryClient: QueryClient, queryHash: string) {
  viewListeners.get(queryClient)?.get(queryHash)?.forEach(listener => listener());
}

function markViewChange(
  registration: RegisteredQuery | undefined,
  previous: CachedRow,
  saved: CachedRow,
  revision: number,
) {
  if (!registration?.ordering) return;
  const previousValue = registration.ordering.getValue(previous);
  const savedValue = registration.ordering.getValue(saved);
  if (compareListSortValues(previousValue, savedValue) === 0) return;

  registration.viewRevision = Math.max(registration.viewRevision, revision);
  registration.editedSortIds.add(saved.id);
}

function recordPendingMutation(queryClient: QueryClient, queryKey: QueryKey, mutation: ListMutation) {
  const tracker = pendingReads.get(queryClient);
  if (!tracker) return;

  for (const query of queryClient.getQueryCache().findAll({ queryKey })) {
    tracker.reads.get(query.queryHash)?.mutations.push(mutation);
  }
}

function updateInfiniteListQueries<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updatePage: (rows: T[], key: QueryKey) => T[],
) {
  for (const [key, current] of queryClient.getQueriesData<InfiniteListData<T>>({ queryKey })) {
    if (!current) continue;

    let changed = false;
    const pages = current.pages.map(page => {
      const rows = updatePage(page.rows, key);
      if (rows === page.rows) return page;
      changed = true;
      return { ...page, rows };
    });
    if (!changed) continue;
    queryClient.setQueryData(key, { ...current, pages });
  }
}

/** Replaces an already-cached row in every list variant under the key prefix. */
export function replaceInfiniteListRow<T extends CachedRow>(queryClient: QueryClient, queryKey: QueryKey, row: T) {
  const tracker = pendingReads.get(queryClient);
  const revision = tracker ? ++tracker.revision : 0;
  recordPendingMutation(queryClient, queryKey, { type: 'replace', row, revision });
  updateInfiniteListQueries<T>(queryClient, queryKey, (rows, key) => {
    const index = rows.findIndex(current => current.id === row.id);
    if (index < 0 || rows[index] === row) return rows;
    const queryHash = listQueryHash(queryClient, key);
    markViewChange(tracker?.registered.get(queryHash), rows[index], row, revision);
    const next = [...rows];
    next[index] = row;
    return next;
  });
}

/** Removes a row from every cached filter/sort variant under the key prefix. */
export function removeInfiniteListRow(queryClient: QueryClient, queryKey: QueryKey, id: string) {
  recordPendingMutation(queryClient, queryKey, { type: 'remove', id });
  updateInfiniteListQueries<CachedRow>(queryClient, queryKey, rows => {
    const next = rows.filter(row => row.id !== id);
    return next.length === rows.length ? rows : next;
  });
}
