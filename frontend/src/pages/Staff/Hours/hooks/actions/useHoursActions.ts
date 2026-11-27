import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../../query/infiniteListCache';

import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import { getBoundedDate } from '../../../../../common/utils/dateRange';
import {
  deleteHours,
  setHours,
  type HoursMutationResult,
} from '../../hours.api';

import type { Task } from '../../../Tasks/types';

import type {
  HoursCalendarIndex,
  HoursFilters,
  Hours,
} from '../../types';

const HOURS_SEARCH_FIELDS = [
  'firstName', 'lastName', 'program', 'cycle', 'category', 'taskTitle', 'sessionTitle', 'note', 'date',
] as const satisfies readonly (keyof Hours)[];

const EMPTY_CALENDAR_INDEX: HoursCalendarIndex = {
  upsert: () => undefined,
  remove: () => undefined,
};

/**
 * Saves Hours rows into loaded views and refreshes their related summaries.
 * @param options - Query prefixes, applied filters, and the callback for closing a deleted entry.
 * @example actions.moveHours(item, date) // replaces the saved row in the table and mounted calendar
 */
export default function useHoursActions({
  hoursQueryKey,
  hoursTableQueryKey,
  taskQueryKey,
  filters,
  onItemRemoved,
}: {
  hoursQueryKey: readonly unknown[];
  hoursTableQueryKey: readonly unknown[];
  taskQueryKey: readonly unknown[];
  filters: HoursFilters;
  onItemRemoved?: (itemId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [pendingItemIds, setPendingItemIds] = useState<ReadonlySet<string>>(() => new Set());
  const pendingItemIdsRef = useRef(new Set<string>());
  const calendarIndexRef = useRef<HoursCalendarIndex>(EMPTY_CALENDAR_INDEX);

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

  // Keep the mounted calendar responsive while a save is pending.
  const applyItem = useCallback((item: Hours) => {
    calendarIndexRef.current.upsert(item);
  }, []);

  const syncHours = useCallback((saved: HoursMutationResult, previous?: Hours) => {
    const { updatedTasks, ...entry } = saved;
    if (!previous || changesTableMembership(previous, entry, filters)) {
      void queryClient.invalidateQueries({ queryKey: hoursTableQueryKey });
    } else {
      replaceInfiniteListRow(queryClient, hoursTableQueryKey, entry);
    }
    applyItem(entry);
    syncTasks(updatedTasks);
    refreshOverview();
  }, [applyItem, filters, hoursTableQueryKey, queryClient, refreshOverview, syncTasks]);

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
    applyItem({ ...previous, date });

    try {
      const updated = await setHours({ date }, item.id);
      syncHours(updated, previous);
    } catch {
      applyItem(previous);
      setMoveError('Unable to move logged hours. The hours were returned to their original day.');
    } finally {
      finishItemAction(item.id);
    }
  }, [applyItem, finishItemAction, startItemAction, syncHours]);

  const requestDelete = useCallback((target: Hours) => setConfirmAction({
    title: 'Delete logged hours',
    message: `Delete these ${target.categoryLabel.toLowerCase()} hours?`,
    confirmVariant: 'danger',
    onConfirm: async () => {
      if (!startItemAction(target.id)) return;

      try {
        const deleted = await deleteHours(target.id);
        removeInfiniteListRow(queryClient, hoursTableQueryKey, target.id);
        calendarIndexRef.current.remove(target.id);
        onItemRemoved?.(target.id);
        refreshOverview();
        syncTasks(deleted.updatedTasks);
      } finally {
        finishItemAction(target.id);
      }
    },
  }), [finishItemAction, hoursTableQueryKey, onItemRemoved, queryClient, refreshOverview, startItemAction, syncTasks]);

  const closeConfirmation = useCallback(() => setConfirmAction(null), []);

  return {
    confirmAction,
    moveError,
    calendarIndexRef,
    isItemPending,
    saveHours,
    moveHours,
    requestDelete,
    closeConfirmation,
  };
}

/**
 * Checks whether a saved edit needs the table to fetch its membership again.
 * @example changesTableMembership(before, saved, filters) // true when the edit leaves the selected category
 */
function changesTableMembership(before: Hours, saved: Hours, filters: HoursFilters): boolean {
  const beforeMatches = matchesTableFilters(before, filters);
  const savedMatches = matchesTableFilters(saved, filters);
  if (beforeMatches !== savedMatches) return true;

  return savedMatches && Boolean(filters.search.trim())
    && HOURS_SEARCH_FIELDS.some(field => before[field] !== saved[field]);
}

/**
 * Applies the exact selections while leaving text matching to the server.
 * @example matchesTableFilters(row, filters) // false when the row falls outside the date bounds
 */
function matchesTableFilters(row: Hours, filters: HoursFilters): boolean {
  return getBoundedDate(row.date, filters.dateRange) === row.date
    && (!filters.staffIds.length || filters.staffIds.includes(row.staffId))
    && (!filters.categories.length || filters.categories.includes(row.category))
    && (!filters.programIds.length || filters.programIds.includes(row.programId ?? 'general'))
    && (!filters.types.length || filters.types.includes(row.type))
    && (!filters.cycleIds?.length || filters.cycleIds.includes(row.cycleId));
}
