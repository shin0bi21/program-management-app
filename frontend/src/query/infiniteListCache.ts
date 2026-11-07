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

/**
 * Tracks edits and deletes across a list's complete fetch, including paused and sequential page reads.
 * Tracking ends when the query leaves the cache; pair reads with reconcileInfiniteListData.
 * @param queryKey - The particular list, including its search/filter/sort inputs.
 * @param options.ordering - Server-compatible sort projection for detecting misplaced edits; passing
 * options without ordering clears it, while omitting options preserves the existing projection.
 * @example Registering ['tasks', 'table', filters] tracks edits during a paused first-page read.
 */
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

/**
 * Subscribes to successful cache writes, query removal, and explicit refresh transitions.
 * Register the query separately to receive cache events; notifications may leave the snapshot unchanged.
 * @param queryKey - The particular list to observe, including its current filters/sorting.
 * @param listener - Called when the consumer should read the list's view state again.
 * @returns A function that removes this listener.
 * @example Two observers of the same list both hear a retained-order change.
 */
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

/**
 * Reports whether saved edits have left adjacent loaded rows out of order.
 * Unloaded neighbors are unknown; duplicate IDs keep their first position and last value.
 * @param queryKey - Identifies the table result, including its filters and sorting.
 * @returns 'current' when no misplaced edited row is detected; otherwise 'refreshing'
 * while a refresh is pending, or 'retained' while the row stays in its old position.
 * @example In ascending name order, renaming Amy to Zoe before Bob returns 'retained'.
 */
export function getInfiniteListViewState(queryClient: QueryClient, queryKey: QueryKey) {
  const registration = pendingReads.get(queryClient)?.registered.get(listQueryHash(queryClient, queryKey));
  if (!registration?.ordering || !registration.editedSortIds.size) return 'current';

  const data = queryClient.getQueryData<InfiniteListData<CachedRow>>(queryKey);
  const loadedRows = data?.pages.flatMap(page => page.rows) ?? [];
  const rows = [...new Map(loadedRows.map(row => [row.id, row])).values()];
  if (!hasMisplacedListRows(rows, registration.editedSortIds, registration.ordering)) return 'current';
  return registration.refresh ? 'refreshing' : 'retained';
}

/**
 * Runs one refresh for a list even if several components request it at once.
 * @param queryKey - Identifies the table result being refreshed, including its filters and sorting.
 * @param refresh - Reloads the list and replaces its cache, cancelling conflicting reads if needed;
 * ignored when this exact query already has a pending refresh.
 * @returns The shared pending refresh; rejects when reloading fails and releases its lock either way.
 * @example Two Refresh clicks while pending invoke the supplied refresh callback once.
 */
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

/**
 * Registers the list before invoking its page loader; cache events track the complete fetch lifetime.
 * Pair this with reconcileInfiniteListData as structuralSharing so later pages cannot undo earlier edits.
 * @param queryKey - Identifies the table result receiving this page, including its filters and sorting.
 * @param load - Fetches { rows, nextCursor } for that page.
 * @returns The loader's promise unchanged; loader rejections and synchronous throws propagate.
 * @example A first-page read started before an edit is reconciled before publication.
 */
export function reconcileInfiniteListRead<T extends CachedRow>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  load: () => Promise<CursorPage<T>>,
): Promise<CursorPage<T>> {
  registerInfiniteListQuery(queryClient, queryKey);
  return load();
}

/**
 * Replays edits and deletes from the active fetch across all incoming pages before publication.
 * Install as the registered infinite query's structuralSharing callback; it does not validate page shapes.
 * @param queryKey - Identifies the table result whose pending edits/deletes must be preserved.
 * @param previous - Previously cached TanStack infinite-page data, if any.
 * @param incoming - Newly fetched TanStack data with pages of { rows, nextCursor }.
 * @returns Fetched pages with newer local changes preserved and unchanged objects reused.
 * @example A response containing an older task-1 is replaced by task-1 saved during its read.
 */
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

/**
 * Updates a saved row in every loaded filter/sort combination where that row already exists.
 * Preserves position, filter membership, and other rows' references; registered reads using
 * reconcileInfiniteListData also preserve this save against older pending responses.
 * @param queryKey - Common start of this table's query keys, e.g. ['tasks', 'table'].
 * Must match only lists containing the same kind of row, not lookups, summaries, or calendars.
 * @param row - Complete record returned by the successful save, including server-derived fields.
 * @example replaceInfiniteListRow(client, ['tasks', 'table'], savedTask) updates loaded task variants in place.
 */
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

/**
 * Removes a deleted row from every loaded filter/sort combination without refetching or backfilling.
 * Registered reads using reconcileInfiniteListData preserve the deletion against older pending responses.
 * @param queryKey - List-only prefix with one row contract, e.g. ['tasks', 'table'];
 * exclude lookups, summaries, and calendars.
 * @param id - ID of the record whose deletion the server confirmed.
 * @example removeInfiniteListRow(client, ['tasks', 'table'], 'task-1') prevents late reads restoring task-1.
 */
export function removeInfiniteListRow(queryClient: QueryClient, queryKey: QueryKey, id: string) {
  recordPendingMutation(queryClient, queryKey, { type: 'remove', id });
  updateInfiniteListQueries<CachedRow>(queryClient, queryKey, rows => {
    const next = rows.filter(row => row.id !== id);
    return next.length === rows.length ? rows : next;
  });
}

/**
 * Resolves an exact query's cache hash, falling back to TanStack's default for new keys.
 * @param queryKey - Identifies one table result, including its filters and sorting.
 * @returns The cached query's hash, or the default hash if it has not been cached yet.
 * @example An existing custom-hashed query keeps the hash used by its cache events.
 */
function listQueryHash(queryClient: QueryClient, queryKey: QueryKey) {
  return queryClient.getQueryCache().find({ queryKey, exact: true })?.queryHash ?? hashKey(queryKey);
}

/**
 * Notifies subscribers of an exact cache hash without allocating registrations.
 * @param queryHash - Hash identifying the table result whose view state changed.
 * @example Removing a registered query prompts its observers to reread their snapshot.
 */
function notifyViewListeners(queryClient: QueryClient, queryHash: string) {
  viewListeners.get(queryClient)?.get(queryHash)?.forEach(listener => listener());
}

/**
 * Marks a row for order checking when an edit changes its active sort value.
 * @param registration - This table result's sort rules and edited-row tracking, if registered.
 * @param previous - Row before the save.
 * @param saved - Complete row returned by the save.
 * @param revision - Sequence number of this edit, used to distinguish edits during a load.
 * @example Changing notes leaves ordering unchanged; changing the active sort name marks its ID.
 */
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

/**
 * Remembers an edit/delete for each still-loading list whose key begins with queryKey.
 * @param queryKey - Common start of the affected table's query keys, such as ['tasks', 'table'].
 * @param mutation - Saved row or deleted ID that pending responses must not overwrite.
 * @example Deleting task-1 during a new filter variant's first fetch prevents resurrection.
 */
function recordPendingMutation(queryClient: QueryClient, queryKey: QueryKey, mutation: ListMutation) {
  const tracker = pendingReads.get(queryClient);
  if (!tracker) return;

  for (const query of queryClient.getQueryCache().findAll({ queryKey })) {
    tracker.reads.get(query.queryHash)?.mutations.push(mutation);
  }
}

/**
 * Changes cached table rows across matching filter/sort combinations.
 * @param queryKey - Common start of this table's query keys, excluding lookups and summaries.
 * @param updatePage - Updates one page's rows; return the original array when nothing changed.
 * @example A variant without the edited row keeps its original infinite-data object.
 */
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
