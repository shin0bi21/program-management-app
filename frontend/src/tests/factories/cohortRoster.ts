import type { CohortRosterYouth } from '../../pages/Programming/Cohorts/types';

export function makeCohortRosterYouth(overrides: Partial<CohortRosterYouth> = {}): CohortRosterYouth {
  return {
    id: 'youth-1',
    firstName: 'Jamie',
    lastName: 'Test',
    dateOfBirth: null,
    age: null,
    schoolName: null,
    cohorts: [],
    ...overrides,
  };
}
