import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../../query/infiniteListCache';

import { getBoundedDate, type DateRange } from '../../../../../common/utils/dateRange';
import {
  deleteHours,
  setHours,
  type HoursMutationResult,
} from '../../api/hours.api';

import type { Task } from '../../../Tasks/types';

import type {
  HoursFilters,
  Hours,
  HoursActions,
} from '../../types';

const HOURS_SEARCH_FIELDS = [
  'firstName', 'lastName', 'program', 'cycle', 'category', 'taskTitle', 'sessionTitle', 'note', 'date',
] as const satisfies readonly (keyof Hours)[];

interface UseHoursActionsOptions {
  hoursQueryKey: readonly unknown[];
  hoursTableQueryKey: readonly unknown[];
  taskQueryKey: readonly unknown[];
  filters: HoursFilters;
  dateRange?: DateRange;
  onItemChanged?: (item: Hours) => void;
  onItemRemoved?: (itemId: Hours['id']) => void;
}

interface HoursActionsResult {
  moveError: string | null;
  isItemPending: HoursActions['isItemPending'];
  saveHours: (input: Partial<Hours>, previous?: Hours, completeTask?: boolean) => Promise<void>;
  moveHours: HoursActions['move'];
  deleteHours: (target: Hours) => Promise<void>;
}

/**
 * Saves Hours rows into loaded views and refreshes their related summaries.
 * @param options - Query prefixes, applied filters and date bounds, and callbacks for reconciling changed or deleted entries.
 * @example actions.moveHours(item, date) // reports a preview followed by the saved or restored entry
 */
export default function useHoursActions({
  hoursQueryKey,
  hoursTableQueryKey,
  taskQueryKey,
  filters,
  dateRange,
  onItemChanged,
  onItemRemoved,
}: UseHoursActionsOptions): HoursActionsResult {
  const queryClient = useQueryClient();
  const [moveError, setMoveError] = useState<string | null>(null);
  const [pendingItemIds, setPendingItemIds] = useState<ReadonlySet<string>>(() => new Set());
  const pendingItemIdsRef = useRef(new Set<string>());

  const startItemAction = useCallback((itemId: string) => {
    if (pendingItemIdsRef.current.has(itemId)) return false;
    pendingItemIdsRef.current.add(itemId);
    setPendingItemIds(new Set(pendingItemIdsRef.current));
    return true;
  }, []);

  const finishItemAction = useCallback((itemId: string) => {
    pendingItemIdsRef.current.delete(itemId);
    setPendingItemIds(new Set(pendingItemIdsRef.current));
  }, []);

  const isItemPending = useCallback(
    (itemId: string) => pendingItemIds.has(itemId),
    [pendingItemIds],
  );

  const refreshOverview = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...hoursQueryKey, 'dashboard'] });
  }, [queryClient, hoursQueryKey]);

  const syncTasks = useCallback((tasks: Task[] = []) => {
    if (!tasks.length) return;

    for (const task of tasks) {
      replaceInfiniteListRow(queryClient, [...taskQueryKey, 'table'], task);
    }
    void queryClient.invalidateQueries({ queryKey: [...taskQueryKey, 'overview'] });
    void queryClient.invalidateQueries({ queryKey: [...taskQueryKey, 'hours-options'] });
  }, [queryClient, taskQueryKey]);

  const syncHours = useCallback((saved: HoursMutationResult, previous?: Hours) => {
    const { updatedTasks, ...entry } = saved;
    if (!previous || changesTableMembership(previous, entry, filters, dateRange)) {
      void queryClient.invalidateQueries({ queryKey: hoursTableQueryKey });
    } else {
      replaceInfiniteListRow(queryClient, hoursTableQueryKey, entry);
    }
    onItemChanged?.(entry);
    syncTasks(updatedTasks);
    refreshOverview();
  }, [dateRange, filters, hoursTableQueryKey, onItemChanged, queryClient, refreshOverview, syncTasks]);

  const saveHours = useCallback(async (input: Partial<Hours>, previous?: Hours, completeTask = false) => {
    const itemId = previous?.id;
    if (itemId && !startItemAction(itemId)) return;

    try {
      const saved = itemId
        ? await setHours(input, itemId)
        : await setHours(input, undefined, completeTask);
      syncHours(saved, previous);
    } finally {
      if (itemId) {
        finishItemAction(itemId);
      }
    }
  }, [finishItemAction, startItemAction, syncHours]);

  const moveHours = useCallback(async (item: Hours, date: Hours['date']) => {
    if (!startItemAction(item.id)) return;

    const previous = item;
    setMoveError(null);
    onItemChanged?.({ ...previous, date });

    try {
      const updated = await setHours({ date }, item.id);
      syncHours(updated, previous);
    } catch {
      onItemChanged?.(previous);
      setMoveError('Unable to move logged hours. The hours were returned to their original day.');
    } finally {
      finishItemAction(item.id);
    }
  }, [finishItemAction, onItemChanged, startItemAction, syncHours]);

  const deleteHoursAction = useCallback(async (target: Hours) => {
    if (!startItemAction(target.id)) return;

    try {
      const deleted = await deleteHours(target.id);
      removeInfiniteListRow(queryClient, hoursTableQueryKey, target.id);
      onItemRemoved?.(target.id);
      refreshOverview();
      syncTasks(deleted.updatedTasks);
    } finally {
      finishItemAction(target.id);
    }
  }, [finishItemAction, hoursTableQueryKey, onItemRemoved, queryClient, refreshOverview, startItemAction, syncTasks]);

  return {
    moveError,
    isItemPending,
    saveHours,
    moveHours,
    deleteHours: deleteHoursAction,
  };
}

/**
 * Checks whether a saved edit needs the table to fetch its membership again.
 * @example changesTableMembership(before, saved, filters, dateRange) // true when the edit leaves the selected category
 */
function changesTableMembership(before: Hours, saved: Hours, filters: HoursFilters, dateRange?: DateRange): boolean {
  const beforeMatches = matchesTableFilters(before, filters, dateRange);
  const savedMatches = matchesTableFilters(saved, filters, dateRange);
  if (beforeMatches !== savedMatches) return true;

  return savedMatches && Boolean(filters.search.trim())
    && HOURS_SEARCH_FIELDS.some(field => before[field] !== saved[field]);
}

/**
 * Applies the exact selections while leaving text matching to the server.
 * @example matchesTableFilters(row, filters, dateRange) // false when the row falls outside the date bounds
 */
function matchesTableFilters(row: Hours, filters: HoursFilters, dateRange?: DateRange): boolean {
  return getBoundedDate(row.date, dateRange) === row.date
    && (!filters.staffIds.length || filters.staffIds.includes(row.staffId))
    && (!filters.categories.length || filters.categories.includes(row.category))
    && (!filters.programIds.length || filters.programIds.includes(row.programId ?? 'general'))
    && (!filters.types.length || filters.types.includes(row.type))
    && (!filters.cycleIds?.length || filters.cycleIds.includes(row.cycleId));
}
