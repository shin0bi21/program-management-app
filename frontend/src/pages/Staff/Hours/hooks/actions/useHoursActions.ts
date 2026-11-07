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

import { taskStore } from '../../../Tasks/taskStore';
import type { Task } from '../../../Tasks/types';
import { getHoursItem, getHoursScope, isHoursScope, removeHoursItem, setHoursItemPending, writeHoursItem } from '../../hoursItemStore';

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
 * Saves, moves, and deletes shared Hours records and reconciles their view indexes.
 * @param options - Query prefixes and the callback for closing a deleted entry.
 * @example actions.moveHours({ item, date }) // both views resolve the changed record
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
    tasks.forEach(task => taskStore.write(queryClient, task));
    if (!tasks.length) return;

    void queryClient.invalidateQueries({ queryKey: [...taskQueryKey, 'overview'] });
    void queryClient.invalidateQueries({ queryKey: [...taskQueryKey, 'hours-options'] });
  }, [queryClient, taskQueryKey]);

  // Save the record once, then update view membership and ordering.
  const applyItem = useCallback((item: HoursItem, created = false) => {
    writeHoursItem(queryClient, item, hoursTableQueryKey);
    if (created) {
      void queryClient.invalidateQueries({ queryKey: hoursTableQueryKey });
    }
    calendarIndexRef.current.upsert(item);
  }, [hoursTableQueryKey, queryClient]);

  const syncHours = useCallback((saved: HoursMutationResult, created = false) => {
    const { updatedTasks, ...entry } = saved;
    applyItem(entry, created);
    syncTasks(updatedTasks);
    refreshOverview();
  }, [applyItem, refreshOverview, syncTasks]);

  const saveHours = useCallback(async (input: SetHoursInput, itemId?: string) => {
    if (itemId && !startItemAction(itemId)) return;

    const scope = getHoursScope(queryClient);
    if (itemId) setHoursItemPending(queryClient, itemId, true, scope);
    try {
      const saved = itemId
        ? await setHours(input, itemId)
        : await setHours(input);
      if (isHoursScope(queryClient, scope)) syncHours(saved, !itemId);
    } finally {
      if (itemId) {
        setHoursItemPending(queryClient, itemId, false, scope);
        finishItemAction(itemId);
      }
    }
  }, [finishItemAction, queryClient, startItemAction, syncHours]);

  const moveHours = useCallback(async ({ item, date }: HoursItemMove) => {
    if (!startItemAction(item.id)) return;

    const scope = getHoursScope(queryClient);
    setHoursItemPending(queryClient, item.id, true, scope);
    const previous = getHoursItem(queryClient, item.id) ?? item;
    setMoveError(null);
    applyItem({ ...previous, date });

    try {
      const updated = await updateHoursPlacement(item.id, { date });
      if (isHoursScope(queryClient, scope)) syncHours(updated);
    } catch {
      if (!isHoursScope(queryClient, scope)) return;
      applyItem(previous);
      setMoveError('Unable to move logged hours. The hours were returned to their original day.');
    } finally {
      setHoursItemPending(queryClient, item.id, false, scope);
      finishItemAction(item.id);
    }
  }, [applyItem, finishItemAction, queryClient, startItemAction, syncHours]);

  const requestDelete = useCallback((target: HoursItem) => setConfirmAction({
    title: 'Delete logged hours',
    message: `Delete these ${target.categoryLabel.toLowerCase()} hours?`,
    confirmVariant: 'danger',
    onConfirm: async () => {
      if (!startItemAction(target.id)) return;

      const scope = getHoursScope(queryClient);
      setHoursItemPending(queryClient, target.id, true, scope);
      try {
        const deleted = await deleteHours(target.id);
        if (!isHoursScope(queryClient, scope)) return;
        removeHoursItem(queryClient, target.id, hoursTableQueryKey);
        calendarIndexRef.current.remove(target.id);
        onItemRemoved?.(target.id);
        refreshOverview();
        syncTasks(deleted.updatedTasks);
      } finally {
        setHoursItemPending(queryClient, target.id, false, scope);
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
