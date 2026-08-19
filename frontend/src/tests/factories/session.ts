import type { CohortSession } from '../../common/types/cohort';

export function makeCohortSession(overrides: Partial<CohortSession> = {}): CohortSession {
  return {
    id: 'session-1',
    cohortId: 'cohort-1',
    sessionTypeId: 'type-1',
    sessionTypeName: 'Regular',
    theme: 'Communication',
    cohortName: 'Summer 2026',
    programId: 'program-1',
    programName: 'Soft Skills',
    rosterMode: 'enrolled',
    startsAt: '2026-08-10T17:00:00.000Z',
    endsAt: '2026-08-10T19:00:00.000Z',
    cancelledAt: null,
    description: null,
    attendanceMarkedCount: 0,
    attendedCount: 0,
    attendanceRate: null,
    state: 'upcoming',
    ...overrides,
  };
}
