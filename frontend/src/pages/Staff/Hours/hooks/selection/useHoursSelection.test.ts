// Owns table/calendar/dashboard selection synchronization and cycle context changes.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeHoursItem } from '../../../../../tests/factories/hours';
import useHoursSelection from './useHoursSelection';

const resources = [
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
];

describe('useHoursSelection', () => {
  it('aligns a selected row with dashboard staff and cycle, then clears it on resource selection', () => {
    const onCycleSelect = vi.fn();
    const { result } = renderHook(() => useHoursSelection({
      resources, currentUserResource: resources[0], cycleId: 'cycle-1', onCycleSelect,
    }));
    const row = {
      id: 'entry-1', resourceId: 'staff-2', date: '2026-08-19',
      staffFirstName: 'Alex', staffLastName: 'Morgan', staffName: 'Alex Morgan',
      item: makeHoursItem({ id: 'entry-1', cycleId: 'cycle-2' }),
    };

    act(() => result.current.selectRow(row));
    expect(result.current.selectedRowId).toBe('entry-1');
    expect(result.current.selectedStaff?.id).toBe('staff-2');
    expect(onCycleSelect).toHaveBeenCalledWith('cycle-2');

    act(() => result.current.selectStaff('staff-1'));
    expect(result.current.selectedRowId).toBeNull();
    expect(result.current.selectedStaff?.id).toBe('staff-1');
  });
});
