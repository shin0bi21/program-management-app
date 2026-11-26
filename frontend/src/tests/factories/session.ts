import type { Session } from '../../common/features/programming/sessions/types';

export function makeProgramSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    cycleId: 'cycle-1',

    sessionType: 'Regular',
    title: 'Communication',
    cycle: 'Summer 2026',
    programId: 'program-1',
    program: 'Future Ready',
    enrollmentRequired: true,
    date: '2026-08-10', startTime: '13:00',
    endTime: '15:00',
    cancelledAt: null,
    description: null,
    state: 'upcoming',
    movable: false,
    ...overrides,
  };
}
