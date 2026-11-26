import { useCallback, useState } from 'react';

import type { Hours, StaffReference } from '../../types';

/**
 * Tracks shared staff selection and the last clicked entry’s row ID.
 * @param options - Visible staff and the current user's default staff member.
 * @example selection.selectRow(entry) // selects its staff member
 */
export default function useHoursSelection({
  staff,
  currentUserStaff,
}: {
  staff: readonly StaffReference[];
  currentUserStaff: StaffReference | null;
}) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const selectRow = useCallback((row: Hours) => {
    setSelectedRowId(row.id);
    setSelectedStaffId(row.staffId);
  }, []);

  const selectStaff = useCallback((staffId: string) => {
    setSelectedStaffId(staffId);
    setSelectedRowId(null);
  }, []);

  const selectedStaff = staff.find(staffMember => staffMember.id === selectedStaffId)
    ?? currentUserStaff;

  return {
    selectedRowId,
    selectedStaff,
    selectRow,
    selectStaff,
  };
}
