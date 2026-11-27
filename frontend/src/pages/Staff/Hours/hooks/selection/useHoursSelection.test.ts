import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeHoursItem } from '../../../../../tests/factories/hours';
import useHoursSelection from './useHoursSelection';

const staff = [
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
];

describe('useHoursSelection', () => {
  it('aligns a selected row with shared staff selection, then clears it on staff member selection', () => {
    const { result } = renderHook(() => useHoursSelection({
      staff, currentUserId: staff[0].id,
    }));
    const row = makeHoursItem({ id: 'entry-1', staffId: 'staff-2', cycleId: 'cycle-2' });
    expect(result.current.selectedStaff?.id).toBe('staff-1');

    act(() => result.current.selectRow(row));
    expect(result.current.selectedRowId).toBe('entry-1');
    expect(result.current.selectedStaff?.id).toBe('staff-2');

    act(() => result.current.selectStaff('staff-1'));
    expect(result.current.selectedRowId).toBeNull();
    expect(result.current.selectedStaff?.id).toBe('staff-1');
  });
});
