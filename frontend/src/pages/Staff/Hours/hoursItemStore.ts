import { skipToken, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { ListSortValue } from '../../../query/listOrdering';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../query/infiniteListCache';
import type { ListSort } from '../../../common/components/Table/Table.types';
import type { HoursItem, HoursSortKey } from './types';

const HOURS_ITEMS_KEY = ['hours', 'items'] as const;

export interface HoursItemRef { id: string }
export interface HoursListIndex extends HoursItemRef { sortValue: ListSortValue }

interface HoursStore {
  scope: symbol;
  revision: number;
  items: Readonly<Record<string, HoursItem>>;
  itemRevisions: Readonly<Record<string, number>>;
  pendingIds: ReadonlySet<string>;
}

interface HoursRead {
  scope: symbol;
  revision: number;
}

/**
 * Supplies the single Hours record owner to a table, calendar, or selection.
 * View caches retain IDs; this query owns complete items and follows normal cache cleanup.
 * @example useHoursItems()[itemId] // latest item, or undefined after deletion
 */
export function useHoursItems() {
  const client = useQueryClient();
  getHoursStore(client);
  return useQuery<HoursStore>({
    queryKey: HOURS_ITEMS_KEY,
    queryFn: skipToken,
    staleTime: Infinity,
  }).data!.items;
}

/**
 * Records when a request started so older responses cannot undo newer changes.
 * @param client - Query client owning Hours data for this account.
 * @example const read = beginHoursRead(client) // call before starting the request
 */
export function beginHoursRead(client: QueryClient): HoursRead {
  const current = getHoursStore(client);
  const revision = current.revision + 1;
  client.setQueryData(HOURS_ITEMS_KEY, { ...current, revision });
  return { scope: current.scope, revision };
}

/**
 * Stores fetched items once and resolves the response IDs to their latest records.
 * Cancelled requests and responses from a cleared account cache cannot publish items.
 * @param client - Query client used when the request started.
 * @param read - Request revision captured before loading.
 * @param incoming - Complete items returned by the server.
 * @param signal - Request cancellation signal.
 * @example finishHoursRead(client, read, items, signal) // saved changes win over older reads
 */
export function finishHoursRead(
  client: QueryClient,
  read: HoursRead,
  incoming: readonly HoursItem[],
  signal: AbortSignal,
): HoursItem[] {
  signal.throwIfAborted();
  const current = client.getQueryData<HoursStore>(HOURS_ITEMS_KEY);
  if (!current || current.scope !== read.scope) return [];

  const items = { ...current.items };
  const itemRevisions = { ...current.itemRevisions };
  for (const item of incoming) {
    if (current.pendingIds.has(item.id) || (itemRevisions[item.id] ?? 0) > read.revision) continue;
    items[item.id] = item;
    itemRevisions[item.id] = read.revision;
  }
  client.setQueryData<HoursStore>(HOURS_ITEMS_KEY, { ...current, items, itemRevisions });

  const saved = client.getQueryData<HoursStore>(HOURS_ITEMS_KEY)!;
  const rows = incoming.flatMap(({ id }) => saved.items[id] ? [saved.items[id]] : []);
  for (const item of rows) updateHoursListIndexes(client, item, ['hours', 'table']);
  return rows;
}

/**
 * Replaces one shared item and updates only the table's ordering metadata.
 * Loaded membership stays in place; shared list helpers protect pending page reads.
 * @param client - Query client owning the item and list indexes.
 * @param item - Complete saved or optimistic item.
 * @param tableKey - Hours list-only key prefix.
 * @example writeHoursItem(client, saved, ['hours', 'table'])
 */
export function writeHoursItem(client: QueryClient, item: HoursItem, tableKey: QueryKey) {
  const current = getHoursStore(client);
  const revision = current.revision + 1;
  client.setQueryData<HoursStore>(HOURS_ITEMS_KEY, {
    ...current,
    revision,
    items: { ...current.items, [item.id]: item },
    itemRevisions: { ...current.itemRevisions, [item.id]: revision },
  });

  updateHoursListIndexes(client, item, tableKey);
}

/**
 * Removes the shared item and its loaded table memberships, retaining a read revision.
 * @param client - Query client owning Hours data.
 * @param id - Confirmed deleted item.
 * @param tableKey - Hours list-only key prefix.
 * @example removeHoursItem(client, itemId, ['hours', 'table'])
 */
export function removeHoursItem(client: QueryClient, id: string, tableKey: QueryKey) {
  const current = getHoursStore(client);
  const revision = current.revision + 1;
  const items = { ...current.items };
  delete items[id];
  client.setQueryData<HoursStore>(HOURS_ITEMS_KEY, {
    ...current,
    revision,
    items,
    itemRevisions: { ...current.itemRevisions, [id]: revision },
  });
  removeInfiniteListRow(client, tableKey, id);
}

/**
 * Reads the latest shared item before starting an optimistic change.
 * @param client - Query client owning Hours data.
 * @param id - Entry to read.
 * @example getHoursItem(client, itemId) // undefined when not loaded
 */
export function getHoursItem(client: QueryClient, id: string) {
  return client.getQueryData<HoursStore>(HOURS_ITEMS_KEY)?.items[id];
}

/**
 * Identifies this account cache so a pending mutation can detect logout or cache clearing.
 * @param client - Query client owning Hours data.
 * @example const scope = getHoursScope(client)
 */
export function getHoursScope(client: QueryClient) {
  return getHoursStore(client).scope;
}

/**
 * Checks whether a request still belongs to the current account cache.
 * @param client - Query client used by the request.
 * @param scope - Scope captured before the request.
 * @example isHoursScope(client, scope) // false after client.clear()
 */
export function isHoursScope(client: QueryClient, scope: symbol) {
  return client.getQueryData<HoursStore>(HOURS_ITEMS_KEY)?.scope === scope;
}

/**
 * Creates the record owner on first use, without starting a request.
 * @param client - Query client owning Hours data.
 * @example getHoursStore(client).revision // 0 before the first read or change
 */
function getHoursStore(client: QueryClient): HoursStore {
  const existing = client.getQueryData<HoursStore>(HOURS_ITEMS_KEY);
  if (existing) return existing;
  const initial: HoursStore = { scope: Symbol('hours'), revision: 0, items: {}, itemRevisions: {}, pendingIds: new Set() };
  client.setQueryData(HOURS_ITEMS_KEY, initial);
  return initial;
}

/**
 * Updates loaded table sort values without copying the record into each list.
 * @param tableKey - List-only prefix whose keys end in the Hours sort choice.
 * @example updateHoursListIndexes(client, item, ['hours', 'table'])
 */
function updateHoursListIndexes(client: QueryClient, item: HoursItem, tableKey: QueryKey) {
  for (const query of client.getQueryCache().findAll({ queryKey: tableKey })) {
    const sorting = query.queryKey[query.queryKey.length - 1] as ListSort<HoursSortKey>;
    const index: HoursListIndex = { id: item.id, sortValue: getHoursSortValue(item, sorting.key) };
    replaceInfiniteListRow(client, query.queryKey, index);
  }
}

/**
 * Protects an item from reads while its save, move, or delete is pending.
 * Completing the change also blocks responses started before it finished.
 * @param scope - Account cache captured before the change; cleared caches are untouched.
 * @example setHoursItemPending(client, itemId, true, scope) // release in finally with false
 */
export function setHoursItemPending(client: QueryClient, id: string, pending: boolean, scope: symbol) {
  const current = client.getQueryData<HoursStore>(HOURS_ITEMS_KEY);
  if (!current || current.scope !== scope) return;

  const pendingIds = new Set(current.pendingIds);
  if (pending) pendingIds.add(id);
  else pendingIds.delete(id);

  const revision = current.revision + 1;
  client.setQueryData<HoursStore>(HOURS_ITEMS_KEY, {
    ...current,
    revision,
    pendingIds,
    itemRevisions: { ...current.itemRevisions, [id]: revision },
  });
}

/**
 * Reads the value used by the server to order an hours item.
 * @param item - Complete hours item.
 * @param key - Selected table sort.
 * @example getHoursSortValue(item, 'hours') // numeric hours
 */
export function getHoursSortValue(item: HoursItem, key: HoursSortKey) {
  const value = item[key];
  return typeof value === 'string' ? value.toLowerCase() : value ?? '';
}
