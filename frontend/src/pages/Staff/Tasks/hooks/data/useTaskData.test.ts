import { getCycleReferences, getProgramReferences, getStaffReferences } from '../../../../../common/features/referenceData/referenceData.api';

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTaskReferenceData } from '../../tasks.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import useTaskData from './useTaskData';

vi.mock('../../tasks.api', () => ({
  getTaskReferenceData: vi.fn(),
}));

const resources = [
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
    vi.mocked(getStaffReferences).mockResolvedValue(resources);
    vi.mocked(getProgramReferences).mockResolvedValue([]);
    vi.mocked(getTaskReferenceData).mockResolvedValue({
      categories: [{ value: 'meeting', label: 'Meeting' }],
      statuses: [{ value: 'active', label: 'Active' }],
    });
  });

  it('loads task reference data and exposes stable derived resources', async () => {
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(() => useTaskData(['task-reference-data']), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(result.current.resources).toEqual(resources));
    const writableResources = result.current.writableResources;

    expect(writableResources.map(resource => resource.id)).toEqual(['staff-1', 'staff-2']);
    rerender();
    expect(result.current.writableResources).toBe(writableResources);
    expect(getTaskReferenceData).toHaveBeenCalledTimes(1);
    expect(getStaffReferences).toHaveBeenCalledWith('tasks', { signal: expect.any(AbortSignal) });
    expect(getProgramReferences).toHaveBeenCalledWith({ assignedOnly: false }, { signal: expect.any(AbortSignal) });
    expect(getCycleReferences).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    expect(result.current.cycles).toEqual([expect.objectContaining({ id: 'cycle-1' })]);
    expect(result.current.cyclesLoading).toBe(false);
    expect(result.current.cyclesError).toBe('');
  });
});

vi.mock('../../../../../common/features/referenceData/referenceData.api', () => ({ getCycleReferences: vi.fn(), getProgramReferences: vi.fn(), getStaffReferences: vi.fn() }));
