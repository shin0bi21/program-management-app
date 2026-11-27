import { getCycleReferences, getProgramReferences, getStaffReferences } from '../../../../../common/features/referenceData/referenceData.api';

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTaskReferenceData } from '../../api/tasks.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import useTaskReferenceData from './useTaskReferenceData';

vi.mock('../../api/tasks.api', () => ({
  getTaskReferenceData: vi.fn(),
}));
vi.mock('../../../../../common/features/referenceData/referenceData.api', () => ({ getCycleReferences: vi.fn(), getProgramReferences: vi.fn(), getStaffReferences: vi.fn() }));

const staff = [
  { id: 'staff-read', firstName: 'Read', lastName: 'Only', name: 'Read Only', role: 'staff', writable: false },
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Ana', lastName: 'Diaz', name: 'Ana Diaz', role: 'staff', writable: true },
];

describe('useTaskReferenceData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCycleReferences).mockResolvedValue([{
      id: 'cycle-1', title: 'Long cycle', startsOn: '2025-01-01', endsOn: '2027-12-31', state: 'active',
    }]);
    vi.mocked(getStaffReferences).mockResolvedValue(staff);
    vi.mocked(getProgramReferences).mockResolvedValue([]);
    vi.mocked(getTaskReferenceData).mockResolvedValue({
      categories: [{ id: 'meeting', name: 'Meeting' }],
      statuses: [{ id: 'in_progress', name: 'In Progress' }],
    });
  });

  it('loads task options and shared references', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useTaskReferenceData(), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(result.current.staff.data).toEqual(staff));
    await waitFor(() => expect(result.current.taskOptions.data?.categories).toEqual([{ id: 'meeting', name: 'Meeting' }]));
    expect(getTaskReferenceData).toHaveBeenCalledTimes(1);
    expect(getStaffReferences).toHaveBeenCalledWith('tasks', { signal: expect.any(AbortSignal) });
    expect(getProgramReferences).toHaveBeenCalledWith({ assignedOnly: false }, { signal: expect.any(AbortSignal) });
    expect(getCycleReferences).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    expect(result.current.cycles.data).toEqual([expect.objectContaining({ id: 'cycle-1' })]);
    expect(result.current.cycles.isLoading).toBe(false);
    expect(result.current.cycles.error).toBeNull();
  });
});
