import { useCallback, useState } from 'react';

import type { StaffResource } from '../../types';

import type { HoursTableRow } from '../../types';

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

  const selectRow = useCallback((row: HoursTableRow) => {
    setSelectedRowId(row.id);
    setSelectedStaffId(row.resourceId);
    setDashboardCycleId(row.item.cycleId);
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
