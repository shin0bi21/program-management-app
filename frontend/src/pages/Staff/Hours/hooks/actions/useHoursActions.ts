import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import {
  deleteHours,
  setHours,
  type SetHoursInput,
  type HoursMutationResult,
  updateHoursPlacement,
} from '../../hours.api';

import type { Task } from '../../../Tasks/types';

import type {
  HoursCalendarIndex,
  HoursItemMove,
  HoursItem,
} from '../../types';

const EMPTY_CALENDAR_INDEX: HoursCalendarIndex = {
  upsert: () => undefined,
  remove: () => undefined,
};

/**
 * Saves, moves, and deletes Hours rows, then refreshes affected queries.
 * @param options - Query prefixes and the callback for closing a deleted entry.
 * @example actions.moveHours({ item, date }) // updates the mounted calendar and refreshes queries
 */
export default function useHoursActions({
  hoursQueryKey,
  hoursTableQueryKey,
  taskQueryKey,
  onItemRemoved,
}: {
  hoursQueryKey: readonly unknown[];
  hoursTableQueryKey: readonly unknown[];
  taskQueryKey: readonly unknown[];
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

    void queryClient.invalidateQueries({ queryKey: [...taskQueryKey, 'table'] });
    void queryClient.invalidateQueries({ queryKey: [...taskQueryKey, 'overview'] });
    void queryClient.invalidateQueries({ queryKey: [...taskQueryKey, 'hours-options'] });
  }, [queryClient, taskQueryKey]);

  // Keep the mounted calendar responsive while table queries refresh.
  const applyItem = useCallback((item: HoursItem) => {
    calendarIndexRef.current.upsert(item);
  }, []);

  const syncHours = useCallback((saved: HoursMutationResult) => {
    const { updatedTasks, ...entry } = saved;
    applyItem(entry);
    void queryClient.invalidateQueries({ queryKey: hoursTableQueryKey });
    syncTasks(updatedTasks);
    refreshOverview();
  }, [applyItem, hoursTableQueryKey, queryClient, refreshOverview, syncTasks]);

  const saveHours = useCallback(async (input: SetHoursInput, itemId?: string) => {
    if (itemId && !startItemAction(itemId)) return;

    try {
      const saved = itemId
        ? await setHours(input, itemId)
        : await setHours(input);
      syncHours(saved);
    } finally {
      if (itemId) {
        finishItemAction(itemId);
      }
    }
  }, [finishItemAction, startItemAction, syncHours]);

  const moveHours = useCallback(async ({ item, date }: HoursItemMove) => {
    if (!startItemAction(item.id)) return;

    const previous = item;
    setMoveError(null);
    applyItem({ ...previous, date });

    try {
      const updated = await updateHoursPlacement(item.id, { date });
      syncHours(updated);
    } catch {
      applyItem(previous);
      setMoveError('Unable to move logged hours. The hours were returned to their original day.');
    } finally {
      finishItemAction(item.id);
    }
  }, [applyItem, finishItemAction, startItemAction, syncHours]);

  const requestDelete = useCallback((target: HoursItem) => setConfirmAction({
    title: 'Delete logged hours',
    message: `Delete these ${target.categoryLabel.toLowerCase()} hours?`,
    confirmVariant: 'danger',
    onConfirm: async () => {
      if (!startItemAction(target.id)) return;

      try {
        const deleted = await deleteHours(target.id);
        void queryClient.invalidateQueries({ queryKey: hoursTableQueryKey });
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
