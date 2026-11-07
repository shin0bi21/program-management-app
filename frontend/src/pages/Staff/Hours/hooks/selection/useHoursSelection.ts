import { useCallback, useState } from 'react';

import type { HoursItem, StaffResource } from '../../types';

/**
 * Tracks selected IDs and the staff/cycle used by the Hours overview.
 * @param options - Visible resources and the current user's default resource.
 * @example selection.selectRow(entry) // selects its staff member and cycle
 */
export default function useHoursSelection({
  resources,
  currentUserResource,
}: {
  resources: readonly StaffResource[];
  currentUserResource: StaffResource | null;
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

  const selectedStaff = resources.find(resource => resource.id === selectedStaffId)
    ?? currentUserResource;

  return {
    dashboardCycleId,
    selectedRowId,
    selectedStaff,
    selectRow,
    selectStaff,
  };
}
