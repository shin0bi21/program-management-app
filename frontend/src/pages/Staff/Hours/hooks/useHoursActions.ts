import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ConfirmAction } from '../../../../common/components/Modal/hooks/useConfirmModal';
import {
  deleteHours,
  setHours,
  type SetHoursInput,
  updateHoursPlacement,
} from '../hours.api';

import type {
  HoursCalendarCache,
  HoursEntryMove,
  HoursEntryTarget,
} from '../types';

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

  const refreshRelatedData = useCallback(async (taskId: string | null) => {
    const refreshes = [queryClient.invalidateQueries({ queryKey: hoursQueryKey })];
    if (taskId) refreshes.push(queryClient.invalidateQueries({ queryKey: taskQueryKey }));
    await Promise.all(refreshes);
  }, [queryClient, taskQueryKey, hoursQueryKey]);

  const saveHours = useCallback(async (input: SetHoursInput, entryId?: string) => {
    if (entryId && !startEntryAction(entryId)) return;

    try {
      const saved = entryId
        ? await setHours(input, entryId)
        : await setHours(input);
      calendarCacheRef.current.upsert(saved.staffId, saved.workDate, saved);
      refreshOverview();
      await refreshRelatedData(saved.taskId);
    } finally {
      if (entryId) finishEntryAction(entryId);
    }
  }, [finishEntryAction, refreshOverview, refreshRelatedData, startEntryAction]);

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
      calendarCacheRef.current.upsert(destination.resourceId, destination.date, updated);
      refreshOverview();

      const refreshes = [queryClient.invalidateQueries({ queryKey: hoursTableQueryKey })];
      if (item.taskId) refreshes.push(queryClient.invalidateQueries({ queryKey: taskQueryKey }));
      await Promise.all(refreshes);
    } catch {
      calendarCacheRef.current.upsert(source.resourceId, source.date, item);
      setMoveError('Unable to move logged hours. The hours were returned to their original day.');
    } finally {
      finishEntryAction(item.id);
    }
  }, [finishEntryAction, queryClient, refreshOverview, startEntryAction, taskQueryKey, hoursTableQueryKey]);

  const requestDelete = useCallback((target: HoursEntryTarget) => setConfirmAction({
    title: 'Delete logged hours',
    message: `Delete these ${target.item.categoryLabel.toLowerCase()} hours?`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    onConfirm: async () => {
      if (!startEntryAction(target.item.id)) return;

      try {
        await deleteHours(target.item.id);
        calendarCacheRef.current.remove(target.item.id);
        onEntryRemoved?.(target.item.id);
        refreshOverview();
        await refreshRelatedData(target.item.taskId);
      } finally {
        finishEntryAction(target.item.id);
      }
    },
  }), [finishEntryAction, onEntryRemoved, refreshOverview, refreshRelatedData, startEntryAction]);

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
