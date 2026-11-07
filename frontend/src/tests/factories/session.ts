import type { ProgramSession } from '../../pages/Programming/Sessions/types';

export function makeProgramSession(overrides: Partial<ProgramSession> = {}): ProgramSession {
  return {
    id: 'session-1',
    cycleId: 'cycle-1',

    sessionType: 'Regular',
    theme: 'Communication',
    cycle: 'Summer 2026',
    programId: 'program-1',
    program: 'Future Ready',
    enrollmentRequired: true,
    startsAt: '2026-08-10T17:00:00.000Z',
    endsAt: '2026-08-10T19:00:00.000Z',
    cancelledAt: null,
    description: null,
    state: 'upcoming',
    ...overrides,
  };
}
