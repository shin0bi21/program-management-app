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

import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../../query/infiniteListCache';
import type { Task } from '../../../Tasks/types';

import type {
  HoursCalendarCache,
  HoursEntryMove,
  HoursEntryTarget,
} from '../../types';

const EMPTY_CALENDAR_CACHE: HoursCalendarCache = {
  upsert: () => undefined,
  remove: () => undefined,
};

export default function useHoursActions({
  hoursQueryKey,
  hoursTableQueryKey,
  taskQueryKey,
  onEntryRemoved,
}: {
  hoursQueryKey: readonly unknown[];
  hoursTableQueryKey: readonly unknown[];
  taskQueryKey: readonly unknown[];
  onEntryRemoved?: (entryId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [pendingEntryIds, setPendingEntryIds] = useState<ReadonlySet<string>>(() => new Set());
  const pendingEntryIdsRef = useRef(new Set<string>());
  const calendarCacheRef = useRef<HoursCalendarCache>(EMPTY_CALENDAR_CACHE);

  const startEntryAction = useCallback((entryId: string) => {
    if (pendingEntryIdsRef.current.has(entryId)) return false;
    pendingEntryIdsRef.current.add(entryId);
    setPendingEntryIds(new Set(pendingEntryIdsRef.current));
    return true;
  }, []);

  const finishEntryAction = useCallback((entryId: string) => {
    pendingEntryIdsRef.current.delete(entryId);
    setPendingEntryIds(new Set(pendingEntryIdsRef.current));
  }, []);

  const isEntryPending = useCallback(
    (entryId: string) => pendingEntryIds.has(entryId),
    [pendingEntryIds],
  );

  const refreshOverview = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...hoursQueryKey, 'dashboard'] });
  }, [queryClient, hoursQueryKey]);

  const syncTasks = useCallback((tasks: Task[] = []) => {
    tasks.forEach(task => replaceInfiniteListRow(queryClient, [...taskQueryKey, 'table'], task));
    if (!tasks.length) return;

    void queryClient.invalidateQueries({ queryKey: [...taskQueryKey, 'overview'] });
    void queryClient.invalidateQueries({ queryKey: [...taskQueryKey, 'hours-options'] });
  }, [queryClient, taskQueryKey]);

  const syncHours = useCallback((saved: HoursMutationResult, created = false) => {
    if (created) {
      void queryClient.invalidateQueries({ queryKey: hoursTableQueryKey });
    } else {
      replaceInfiniteListRow(queryClient, hoursTableQueryKey, saved.tableRow);
    }

    calendarCacheRef.current.upsert(saved.staffId, saved.workDate, saved.tableRow.item);
    refreshOverview();
  }, [hoursTableQueryKey, queryClient, refreshOverview]);

  const saveHours = useCallback(async (input: SetHoursInput, entryId?: string) => {
    if (entryId && !startEntryAction(entryId)) return;

    try {
      const saved = entryId
        ? await setHours(input, entryId)
        : await setHours(input);
      syncHours(saved, !entryId);
      syncTasks(saved.updatedTasks);
    } finally {
      if (entryId) finishEntryAction(entryId);
    }
  }, [finishEntryAction, startEntryAction, syncHours, syncTasks]);

  const moveHours = useCallback(async ({
    item,
    source,
    destination,
  }: HoursEntryMove) => {
    if (!startEntryAction(item.id)) return;

    setMoveError(null);
    calendarCacheRef.current.upsert(destination.resourceId, destination.date, item);

    try {
      const updated = await updateHoursPlacement(item.id, { workDate: destination.date });
      syncHours(updated);
      syncTasks(updated.updatedTasks);
    } catch {
      calendarCacheRef.current.upsert(source.resourceId, source.date, item);
      setMoveError('Unable to move logged hours. The hours were returned to their original day.');
    } finally {
      finishEntryAction(item.id);
    }
  }, [finishEntryAction, startEntryAction, syncHours, syncTasks]);

  const requestDelete = useCallback((target: HoursEntryTarget) => setConfirmAction({
    title: 'Delete logged hours',
    message: `Delete these ${target.item.categoryLabel.toLowerCase()} hours?`,
    confirmVariant: 'danger',
    onConfirm: async () => {
      if (!startEntryAction(target.item.id)) return;

      try {
        const deleted = await deleteHours(target.item.id);
        removeInfiniteListRow(queryClient, hoursTableQueryKey, target.item.id);
        calendarCacheRef.current.remove(target.item.id);
        onEntryRemoved?.(target.item.id);
        refreshOverview();
        syncTasks(deleted.updatedTasks);
      } finally {
        finishEntryAction(target.item.id);
      }
    },
  }), [finishEntryAction, hoursTableQueryKey, onEntryRemoved, queryClient, refreshOverview, startEntryAction, syncTasks]);

  const closeConfirmation = useCallback(() => setConfirmAction(null), []);

  return {
    confirmAction,
    moveError,
    calendarCacheRef,
    isEntryPending,
    saveHours,
    moveHours,
    requestDelete,
    closeConfirmation,
  };
}
