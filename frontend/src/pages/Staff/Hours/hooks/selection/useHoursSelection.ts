import { useCallback, useState } from 'react';

import type { StaffReference } from '../../../../../common/features/referenceData/referenceData.api';
import type { Hours } from '../../types';

interface UseHoursSelectionOptions {
  staff: readonly StaffReference[];
  currentUserStaff: StaffReference | null;
}

interface HoursSelectionResult {
  selectedRowId: Hours['id'] | null;
  selectedStaff: StaffReference | null;
  selectRow: (row: Hours) => void;
  selectStaff: (staffId: Hours['staffId']) => void;
}

/**
 * Tracks shared staff selection and the last clicked entry’s row ID.
 * @param options - Visible staff and the current user's default staff member.
 * @example selection.selectRow(entry) // selects its staff member
 */
export default function useHoursSelection({
  staff,
  currentUserStaff,
}: UseHoursSelectionOptions): HoursSelectionResult {
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
