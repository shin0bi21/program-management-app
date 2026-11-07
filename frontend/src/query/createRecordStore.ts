import { replaceEqualDeep, skipToken, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { removeInfiniteListRow, replaceInfiniteListRow } from './infiniteListCache';
import type { ListSortValue } from './listOrdering';

export interface RecordReference { id: string }
export interface RecordListIndex extends RecordReference { sortValue: ListSortValue }

interface RecordStore<T> {
  scope: symbol;
  revision: number;
  records: Readonly<Record<string, T>>;
  recordRevisions: Readonly<Record<string, number>>;
  pendingIds: ReadonlySet<string>;
}

interface RecordRead { scope: symbol; revision: number }

interface RecordStoreOptions<T> {
  queryKey: QueryKey;
  listKey: QueryKey;
  getSortValue: (record: T, queryKey: QueryKey) => ListSortValue;
}

/**
 * Creates one feature's record owner; paginated lists and range buffers retain only indexes.
 * Reads and mutations share revisions, pending protection, deletion markers, and account cleanup.
 * @param options - Feature keys and the server-compatible sort projection for each list variant.
 * @example const taskStore = createRecordStore<Task>({ queryKey, listKey, getSortValue })
 */
export function createRecordStore<T extends RecordReference>({ queryKey, listKey, getSortValue }: RecordStoreOptions<T>) {
  /**
   * Initializes this account's owner without fetching records.
   * @example getStore(client).revision // 0 before the first read
   */
  function getStore(client: QueryClient): RecordStore<T> {
    const existing = client.getQueryData<RecordStore<T>>(queryKey);
    if (existing) return existing;

    const initial: RecordStore<T> = {
      scope: Symbol('records'), revision: 0, records: {}, recordRevisions: {}, pendingIds: new Set(),
    };
    client.setQueryData(queryKey, initial);
    return initial;
  }

  /**
   * Observes complete records while leaving request and membership ownership with each view.
   * @example const selected = store.useRecords()[selectedId]
   */
  function useRecords() {
    const client = useQueryClient();
    getStore(client);
    return useQuery({
      queryKey, queryFn: skipToken, staleTime: Infinity,
      // Each observer must receive the owner's objects, without cloning its selected snapshot.
      structuralSharing: false,
      select: (state: RecordStore<T>) => state.records,
    }).data!;
  }

  /**
   * Captures the account and request order before fetching a page or date range.
   * @example const read = store.beginRead(client)
   */
  function beginRead(client: QueryClient): RecordRead {
    const current = getStore(client);
    const revision = current.revision + 1;
    client.setQueryData(queryKey, { ...current, revision });
    return { scope: current.scope, revision };
  }

  /**
   * Updates only loaded lists' sort metadata, preserving their membership and cursor positions.
   * @example updateListIndexes(client, savedTask)
   */
  function updateListIndexes(client: QueryClient, record: T) {
    for (const query of client.getQueryCache().findAll({ queryKey: listKey })) {
      const index = { id: record.id, sortValue: getSortValue(record, query.queryKey) };
      replaceInfiniteListRow(client, query.queryKey, index);
    }
  }

  /**
   * Publishes fetched records unless newer reads or mutations already own their values.
   * Cancelled reads throw; responses from a cleared account return no records.
   * @example store.finishRead(client, read, response.rows, signal)
   */
  function finishRead(client: QueryClient, read: RecordRead, incoming: readonly T[], signal: AbortSignal): T[] {
    signal.throwIfAborted();
    const current = client.getQueryData<RecordStore<T>>(queryKey);
    if (!current || current.scope !== read.scope) return [];

    const records = { ...current.records };
    const recordRevisions = { ...current.recordRevisions };
    for (const record of incoming) {
      const superseded = (recordRevisions[record.id] ?? 0) > read.revision;
      if (current.pendingIds.has(record.id) || superseded) continue;

      records[record.id] = replaceEqualDeep(current.records[record.id], record);
      recordRevisions[record.id] = read.revision;
    }
    client.setQueryData<RecordStore<T>>(queryKey, { ...current, records, recordRevisions });

    const saved = client.getQueryData<RecordStore<T>>(queryKey)!;
    const resolved = incoming.flatMap(({ id }) => saved.records[id] ? [saved.records[id]] : []);
    for (const record of resolved) updateListIndexes(client, record);
    return resolved;
  }

  /**
   * Writes a complete saved record once and reconciles loaded table indexes.
   * @example store.write(client, savedTask)
   */
  function write(client: QueryClient, record: T) {
    const current = getStore(client);
    const revision = current.revision + 1;
    client.setQueryData<RecordStore<T>>(queryKey, {
      ...current, revision,
      records: { ...current.records, [record.id]: replaceEqualDeep(current.records[record.id], record) },
      recordRevisions: { ...current.recordRevisions, [record.id]: revision },
    });
    updateListIndexes(client, record);
  }

  /**
   * Deletes a record and table memberships, retaining a marker against older pending reads.
   * @example store.remove(client, 'task-1')
   */
  function remove(client: QueryClient, id: string) {
    const current = getStore(client);
    const revision = current.revision + 1;
    const records = { ...current.records };
    delete records[id];
    client.setQueryData<RecordStore<T>>(queryKey, {
      ...current, revision, records,
      recordRevisions: { ...current.recordRevisions, [id]: revision },
    });
    removeInfiniteListRow(client, listKey, id);
  }

  /**
   * Protects a record throughout a mutation, including reads started before completion.
   * @param scope - Account scope captured before starting the mutation.
   * @example store.setPending(client, task.id, true, scope) // release in finally
   */
  function setPending(client: QueryClient, id: string, pending: boolean, scope: symbol) {
    const current = client.getQueryData<RecordStore<T>>(queryKey);
    if (!current || current.scope !== scope) return;

    const pendingIds = new Set(current.pendingIds);
    if (pending) pendingIds.add(id);
    else pendingIds.delete(id);

    const revision = current.revision + 1;
    client.setQueryData<RecordStore<T>>(queryKey, {
      ...current, revision, pendingIds,
      recordRevisions: { ...current.recordRevisions, [id]: revision },
    });
  }

  /**
   * Reads the latest record without subscribing or allocating another copy.
   * @example store.get(client, 'task-1') // undefined after deletion
   */
  function get(client: QueryClient, id: string) {
    return client.getQueryData<RecordStore<T>>(queryKey)?.records[id];
  }

  /**
   * Identifies this account cache before asynchronous work begins.
   * @example const scope = store.getScope(client)
   */
  function getScope(client: QueryClient) { return getStore(client).scope; }

  /**
   * Rejects asynchronous completions belonging to a cleared account cache.
   * @example store.isScope(client, scope) // false after client.clear()
   */
  function isScope(client: QueryClient, scope: symbol) {
    return client.getQueryData<RecordStore<T>>(queryKey)?.scope === scope;
  }

  return { useRecords, beginRead, finishRead, write, remove, setPending, get, getScope, isScope };
}
