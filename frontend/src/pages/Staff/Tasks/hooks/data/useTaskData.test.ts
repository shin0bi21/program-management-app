import { getCycleReferences, getProgramReferences, getStaffReferences } from '../../../../../common/features/referenceData/referenceData.api';

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTaskReferenceData } from '../../tasks.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import useTaskData from './useTaskData';

vi.mock('../../tasks.api', () => ({
  getTaskReferenceData: vi.fn(),
}));
vi.mock('../../../../../common/features/referenceData/referenceData.api', () => ({ getCycleReferences: vi.fn(), getProgramReferences: vi.fn(), getStaffReferences: vi.fn() }));

const staff = [
  { id: 'staff-read', firstName: 'Read', lastName: 'Only', name: 'Read Only', role: 'staff', writable: false },
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Ana', lastName: 'Diaz', name: 'Ana Diaz', role: 'staff', writable: true },
];

describe('useTaskData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCycleReferences).mockResolvedValue([{
      id: 'cycle-1', name: 'Long cycle', startsOn: '2025-01-01', endsOn: '2027-12-31', state: 'active',
    }]);
    vi.mocked(getStaffReferences).mockResolvedValue(staff);
    vi.mocked(getProgramReferences).mockResolvedValue([]);
    vi.mocked(getTaskReferenceData).mockResolvedValue({
      categories: [{ value: 'meeting', label: 'Meeting' }],
      statuses: [{ value: 'in_progress', label: 'In Progress' }],
    });
  });

  it('loads task reference data and exposes stable derived staff', async () => {
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(() => useTaskData(['task-reference-data']), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(result.current.staff).toEqual(staff));
    const writableStaff = result.current.writableStaff;

    expect(writableStaff.map(staffMember => staffMember.id)).toEqual(['staff-1', 'staff-2']);
    rerender();
    expect(result.current.writableStaff).toBe(writableStaff);
    expect(getTaskReferenceData).toHaveBeenCalledTimes(1);
    expect(getStaffReferences).toHaveBeenCalledWith('tasks', { signal: expect.any(AbortSignal) });
    expect(getProgramReferences).toHaveBeenCalledWith({ assignedOnly: false }, { signal: expect.any(AbortSignal) });
    expect(getCycleReferences).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    expect(result.current.cycles).toEqual([expect.objectContaining({ id: 'cycle-1' })]);
    expect(result.current.cyclesLoading).toBe(false);
    expect(result.current.cyclesError).toBe('');
  });
});
