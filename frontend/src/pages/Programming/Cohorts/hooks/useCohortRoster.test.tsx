import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getYouth } from '../../../../common/features/youth/youth.api';
import type { ProgramCohort } from '../../../../common/types/cohort';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import { useCohortRoster } from './useCohortRoster';

vi.mock('../../../../common/features/youth/youth.api', () => ({ getYouth: vi.fn() }));

const cohort: ProgramCohort = {
  id: 'cohort-1',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
  cycleId: 'cycle-1',
  cycleName: 'Summer 2026',
  name: 'Summer 2026',
  startsOn: '2026-06-30',
  endsOn: '2026-08-31',
  state: 'active',
  enrolledCount: 1,
  nextSessionAt: null,
  nextSessionId: null,
  averageAttendance: null,
  attendanceAttendedCount: 0,
  attendanceRecordedCount: 0,
  uniqueAttendeeCount: 0,
};

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('useCohortRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getYouth).mockResolvedValue([
      makeYouthProfile({
        id: 'enrolled',
        firstName: 'Enrolled',
        cohorts: [{
          id: cohort.id,
          name: cohort.name,
          programId: cohort.programId,
          programName: cohort.programName,
          rosterMode: 'enrolled',
          startsOn: cohort.startsOn,
          endsOn: cohort.endsOn,
          enrolledOn: cohort.startsOn,
          withdrawnOn: null,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          lastAttendedOn: null,
        }],
      }),
      makeYouthProfile({ id: 'available', firstName: 'Available' }),
    ]);
  });

  it('separates the roster and preserves search while cohort identity is unchanged', async () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: ProgramCohort | null }) => useCohortRoster(target),
      { initialProps: { target: cohort }, wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enrolledYouth.map((profile) => profile.id)).toEqual(['enrolled']);
    expect(result.current.unenrolledYouth.map((profile) => profile.id)).toEqual(['available']);

    act(() => result.current.setSearch('available'));
    rerender({ target: { ...cohort, name: 'Updated label' } });
    expect(result.current.search).toBe('available');

    rerender({ target: { ...cohort, id: 'cohort-2' } });
    await waitFor(() => expect(result.current.search).toBe(''));
  });
});
