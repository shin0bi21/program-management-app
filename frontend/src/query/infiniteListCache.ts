import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type { CursorPage } from './types';

type InfiniteListData<T> = InfiniteData<CursorPage<T>>;

function updateInfiniteListQueries<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updatePage: (rows: T[]) => T[],
) {
  queryClient.setQueriesData<InfiniteListData<T>>({ queryKey }, current => {
    if (!current) return current;
    let changed = false;
    const pages = current.pages.map(page => {
      const rows = updatePage(page.rows);
      if (rows === page.rows) return page;
      changed = true;
      return { ...page, rows };
    });
    return changed ? { ...current, pages } : current;
  });
}

/** Replaces an already-cached row in every list variant under the key prefix. */
export function replaceInfiniteListRow<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  row: T,
) {
  updateInfiniteListQueries<T>(queryClient, queryKey, rows => {
    const index = rows.findIndex(current => current.id === row.id);
    if (index < 0 || rows[index] === row) return rows;
    const next = [...rows];
    next[index] = row;
    return next;
  });
}

/** Removes a row from every cached filter/sort variant under the key prefix. */
export function removeInfiniteListRow(
  queryClient: QueryClient,
  queryKey: QueryKey,
  id: string,
) {
  updateInfiniteListQueries<{ id: string }>(queryClient, queryKey, rows => {
    const next = rows.filter(row => row.id !== id);
    return next.length === rows.length ? rows : next;
  });
}
