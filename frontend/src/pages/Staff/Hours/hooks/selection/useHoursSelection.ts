import { useCallback, useState } from 'react';

import type { HoursItem, StaffReference } from '../../types';

/**
 * Tracks selected IDs and the staff/cycle used by the Hours overview.
 * @param options - Visible staff and the current user's default staff member.
 * @example selection.selectRow(entry) // selects its staff member and cycle
 */
export default function useHoursSelection({
  staff,
  currentUserStaff,
}: {
  staff: readonly StaffReference[];
  currentUserStaff: StaffReference | null;
}) {
  const [dashboardCycleId, setDashboardCycleId] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const selectRow = useCallback((row: HoursItem) => {
    setSelectedRowId(row.id);
    setSelectedStaffId(row.staffId);
    setDashboardCycleId(row.cycleId);
  }, []);

  const selectStaff = useCallback((staffId: string) => {
    setSelectedStaffId(staffId);
    setSelectedRowId(null);
  }, []);

  const selectedStaff = staff.find(staffMember => staffMember.id === selectedStaffId)
    ?? currentUserStaff;

  return {
    dashboardCycleId,
    selectedRowId,
    selectedStaff,
    selectRow,
    selectStaff,
  };
}
