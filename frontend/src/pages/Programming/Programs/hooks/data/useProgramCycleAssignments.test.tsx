import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProgramCycleAssignments } from '../../api/programCycleAssignments.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { useProgramCycleAssignments } from './useProgramCycleAssignments';

vi.mock('../../api/programCycleAssignments.api', () => ({ getProgramCycleAssignments: vi.fn() }));

describe('useProgramCycleAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProgramCycleAssignments).mockResolvedValue([{
      programId: 'program-1',
      program: 'Soft Skills',
      cycleId: 'cycle-1',
      cycle: 'Summer 2026',
      startsOn: '2026-07-01',
      endsOn: '2026-08-31',
      state: 'active',
      enrollmentRequired: true,
      minAge: 12,
      maxAge: 15,
      enrolledCount: 10,
      nextSessionDate: null,
      nextSessionId: null,
      uniqueAttendeeCount: 0,
    }]);
  });

  it('loads program-scoped programCycle options through the shared list lifecycle', async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useProgramCycleAssignments('program-1'), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.assignments).toHaveLength(1));
    expect(getProgramCycleAssignments).toHaveBeenCalledWith('program-1', { includeAllPrograms: false }, {
      signal: expect.any(AbortSignal),
    });
    expect(result.current.error).toBe('');
  });
});
