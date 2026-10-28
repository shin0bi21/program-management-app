import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCohorts } from '../../../Cohorts/cohorts.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { useCohorts } from './useCohorts';

vi.mock('../../../Cohorts/cohorts.api', () => ({ getCohorts: vi.fn() }));

describe('useCohorts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCohorts).mockResolvedValue([{
      id: 'cohort-1',
      programId: 'program-1',
      programName: 'Soft Skills',
      cycleId: 'cycle-1',
      cycleName: 'Summer 2026',
      name: 'Summer 2026',
      startsOn: '2026-07-01',
      endsOn: '2026-08-31',
      state: 'active',
      enrollmentRequired: true,
      minAge: 12,
      maxAge: 15,
      enrolledCount: 10,
      nextSessionAt: null,
      nextSessionId: null,
      averageAttendance: null,
      attendanceAttendedCount: 0,
      attendanceRecordedCount: 0,
      uniqueAttendeeCount: 0,
    }]);
  });

  it('loads program-scoped cohort options through the shared list lifecycle', async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useCohorts('program-1'), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.cohorts).toHaveLength(1));
    expect(getCohorts).toHaveBeenCalledWith('program-1', {}, {
      signal: expect.any(AbortSignal),
    });
    expect(result.current.error).toBe('');
  });
});
