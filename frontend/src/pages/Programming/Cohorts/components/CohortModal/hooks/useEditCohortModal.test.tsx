import type { FormEvent } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateCohort } from '../../../cohorts.api';
import type { ProgramCohort } from '../../../types';
import { useEditCohortModal } from './useEditCohortModal';

vi.mock('../../../cohorts.api', () => ({
  updateCohort: vi.fn(),
}));

const cohort: ProgramCohort = {
  id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', rosterMode: 'enrolled',
  cycleId: 'cycle-1', cycleName: 'Summer 2026', name: 'Summer 2026', startsOn: '2026-07-01',
  endsOn: '2026-08-31', state: 'active', minAge: 12, maxAge: 15, enrolledCount: 5,
  nextSessionAt: null, nextSessionId: null, averageAttendance: null, attendanceAttendedCount: 0,
  attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
};
const submitEvent = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;

describe('useEditCohortModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initializes from the target and owns successful cohort updates', async () => {
    vi.mocked(updateCohort).mockResolvedValue(cohort);
    const onUpdated = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useEditCohortModal({ cohort, onUpdated }));

    await waitFor(() => expect(result.current.cycleId).toBe('cycle-1'));
    act(() => result.current.setCycleId('cycle-2'));
    await act(() => result.current.submit(submitEvent));

    expect(updateCohort).toHaveBeenCalledWith('cohort-1', { cycleId: 'cycle-2' });
    expect(onUpdated).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({
      status: 'success',
      statusMessage: 'Cohort updated successfully.',
    });
  });
});
