import type { ProgramRosterYouth } from '../../pages/Programming/Programs/api/programCycleAssignments.api';

export function makeProgramRosterYouth(overrides: Partial<ProgramRosterYouth> = {}): ProgramRosterYouth {
  return {
    id: 'youth-1',
    firstName: 'Jamie',
    lastName: 'Test',
    dateOfBirth: null,
    age: null,
    schoolName: null,
    programCycles: [],
    ...overrides,
  };
}
