import { useCallback, useState } from 'react';

import type { StaffResource } from '../../../../common/features/hours/types';

import type { HoursListRow } from '../types';

export default function useHoursSelection({
  resources,
  currentUserResource,
  cycleId,
  onCycleSelect,
}: {
  resources: readonly StaffResource[];
  currentUserResource: StaffResource | null;
  cycleId: string | null;
  onCycleSelect: (cycleId: string) => void;
}) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const selectRow = useCallback((row: HoursListRow) => {
    setSelectedRowId(row.id);
    setSelectedStaffId(row.resourceId);
    if (row.item.cycleId !== cycleId) onCycleSelect(row.item.cycleId);
  }, [cycleId, onCycleSelect]);

  const selectStaff = useCallback((staffId: string) => {
    setSelectedStaffId(staffId);
    setSelectedRowId(null);
  }, []);

  const selectedStaff = resources.find(resource => resource.id === selectedStaffId)
    ?? currentUserResource;

  return {
    selectedRowId,
    selectedStaff,
    selectRow,
    selectStaff,
  };
}
