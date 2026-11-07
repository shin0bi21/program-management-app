import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeHoursItem } from '../../../../../tests/factories/hours';
import useHoursSelection from './useHoursSelection';

const resources = [
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
];

describe('useHoursSelection', () => {
  it('aligns a selected row with dashboard staff and cycle, then clears it on resource selection', () => {
    const { result } = renderHook(() => useHoursSelection({
      resources, currentUserResource: resources[0],
    }));
    const row = makeHoursItem({ id: 'entry-1', staffId: 'staff-2', cycleId: 'cycle-2' });

    act(() => result.current.selectRow(row));
    expect(result.current.selectedRowId).toBe('entry-1');
    expect(result.current.selectedStaff?.id).toBe('staff-2');
    expect(result.current.dashboardCycleId).toBe('cycle-2');

    act(() => result.current.selectStaff('staff-1'));
    expect(result.current.selectedRowId).toBeNull();
    expect(result.current.selectedStaff?.id).toBe('staff-1');
  });
});
