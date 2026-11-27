import { useCallback, useEffect, useMemo, useState } from 'react';

import type { StaffReference } from '../../../../../common/features/referenceData/referenceData.api';
import type { Task } from '../../types';

interface UseTaskSelectionOptions {
  staff: StaffReference[];
}

interface TaskSelectionResult {
  selectedStaffId: string | null;
  selectedStaff: StaffReference | null;
  selectedTaskId: string | null;
  selectedTask: Task | null;
  selectTask: (task: Task) => void;
  selectStaff: (staffId: string) => void;
  removeSelectedTask: (taskId: string) => void;
  onTaskSynced: (task: Task) => void;
}

/**
 * Keeps the clicked task as temporary selection context for dashboards.
 * @param options - Current staff choices supplied by the page.
 * @example useTaskSelection({ staff }).selectedTask
 */
export default function useTaskSelection({
  staff,
}: UseTaskSelectionOptions): TaskSelectionResult {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const selectedStaffId = selectedTask?.staffId ?? staffId;

  const selectedStaff = useMemo(
    () => staff.find(staffMember => staffMember.id === selectedStaffId) ?? null,
    [staff, selectedStaffId],
  );

  // Preserve a valid selection, then prefer a writable staff member before a readable fallback.
  useEffect(() => {
    if (selectedStaffId && staff.some(staffMember => staffMember.id === selectedStaffId)) {
      if (staffId !== selectedStaffId) setStaffId(selectedStaffId);
      return;
    }

    const fallbackStaffId = staff.find(staffMember => staffMember.writable)?.id
      ?? staff[0]?.id
      ?? null;

    setStaffId(fallbackStaffId);
    setSelectedTask(current => current?.staffId === fallbackStaffId ? current : null);
  }, [staffId, staff, selectedStaffId]);

  // Selection transitions.
  const selectTask = useCallback((task: Task) => {
    setStaffId(task.staffId);
    setSelectedTask(task);
  }, []);

  const selectStaff = useCallback((staffId: string) => {
    setStaffId(staffId);
    setSelectedTask(null);
  }, []);

  const removeSelectedTask = useCallback((taskId: string) => {
    setSelectedTask(current => current?.id === taskId ? null : current);
  }, []);

  const onTaskSynced = useCallback((task: Task) => {
    setSelectedTask(current => current?.id === task.id ? task : current);
  }, []);

  return {
    selectedStaffId,
    selectedStaff,
    selectedTaskId: selectedTask?.id ?? null,
    selectedTask,
    selectTask,
    selectStaff,
    removeSelectedTask,
    onTaskSynced,
  };
}
