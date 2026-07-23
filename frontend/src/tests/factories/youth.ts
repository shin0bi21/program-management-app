import type { YouthProfile } from '../../common/types/youth';

export function makeYouthProfile(overrides: Partial<YouthProfile> = {}): YouthProfile {
  return {
    id: 'youth-1',
    firstName: 'Jamie',
    lastName: 'Test',
    status: 'active',
    account: null,
    dateOfBirth: null,
    schoolId: null,
    schoolName: null,
    programId: null,
    programName: null,
    notes: null,
    gradeLevel: null,
    ageGroup: null,
    createdAt: '2026-01-01T00:00:00Z',
    addresses: null,
    contacts: null,
    ...overrides,
  };
}
