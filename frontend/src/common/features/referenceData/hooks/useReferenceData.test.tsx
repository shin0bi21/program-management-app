import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { getCycleReferences, getProgramReferences, getSchoolReferences, getStaffReferences } from '../referenceData.api';
import { referenceDataKeys, useCycleReferences, useProgramReferences, useSchoolReferences, useStaffReferences } from './useReferenceData';

vi.mock('../referenceData.api', () => ({
  getCycleReferences: vi.fn(),
  getProgramReferences: vi.fn(),
  getSchoolReferences: vi.fn(),
  getStaffReferences: vi.fn(),
}));

describe('shared reference queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCycleReferences).mockResolvedValue([]);
    vi.mocked(getSchoolReferences).mockResolvedValue([]);
    vi.mocked(getProgramReferences).mockImplementation(async ({ assignedOnly } = {}) => [
      { id: assignedOnly ? 'assigned-program' : 'all-programs', title: 'Program' },
    ]);
    vi.mocked(getStaffReferences).mockImplementation(async feature => [{
      id: 'staff-1', name: 'Staff One', firstName: 'Staff', lastName: 'One', role: 'staff', writable: feature === 'tasks',
    }]);
  });

  it('uses canonical cycle/school keys and forwards cancellation', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => ({ cycles: useCycleReferences(), schools: useSchoolReferences() }), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(result.current.cycles.isLoading || result.current.schools.isLoading).toBe(false));
    expect(getCycleReferences).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    expect(getSchoolReferences).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    expect(client.getQueryData(referenceDataKeys.cycles)).toEqual([]);
    expect(client.getQueryData(referenceDataKeys.schools)).toEqual([]);
  });

  it('keeps assigned program scopes and feature-specific staff capabilities in separate caches', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => ({
      programs: useProgramReferences(), assigned: useProgramReferences({ assignedOnly: true }),
      tasks: useStaffReferences('tasks'), hours: useStaffReferences('hours'),
    }), { wrapper: createQueryClientWrapper(client) });

    await waitFor(() => expect(result.current.hours.data).toHaveLength(1));
    expect(result.current.programs.data?.[0].id).toBe('all-programs');
    expect(result.current.assigned.data?.[0].id).toBe('assigned-program');
    expect(result.current.tasks.data?.[0].writable).toBe(true);
    expect(result.current.hours.data?.[0].writable).toBe(false);
    expect(getProgramReferences).toHaveBeenCalledWith({ assignedOnly: true }, { signal: expect.any(AbortSignal) });
    expect(getProgramReferences).toHaveBeenCalledWith({ assignedOnly: false }, { signal: expect.any(AbortSignal) });
    expect(getStaffReferences).toHaveBeenCalledWith('tasks', { signal: expect.any(AbortSignal) });
    expect(getStaffReferences).toHaveBeenCalledWith('hours', { signal: expect.any(AbortSignal) });
    expect(client.getQueryData(referenceDataKeys.programs(true))).toEqual(result.current.assigned.data);
    expect(client.getQueryData(referenceDataKeys.programs())).toEqual(result.current.programs.data);
    expect(client.getQueryData(referenceDataKeys.staff('tasks'))).toEqual(result.current.tasks.data);
    expect(client.getQueryData(referenceDataKeys.staff('hours'))).toEqual(result.current.hours.data);
  });
});
