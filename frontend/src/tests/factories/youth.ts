import type { YouthProfile } from '../../pages/Youth/types';

/**
 * Creates a complete youth profile fixture with no active programs or contacts.
 * @param overrides - Profile fields to replace for the test's scenario.
 * @example makeYouthProfile({ firstName: 'Sam' }) // profile named Sam
 */
export function makeYouthProfile(overrides: Partial<YouthProfile> = {}): YouthProfile {
  return {
    id: 'youth-1',
    firstName: 'Jamie',
    lastName: 'Test',
    account: null,
    dateOfBirth: null,
    schoolId: null,
    schoolName: null,
    activeProgram: null,
    createdAt: '2026-01-01T00:00:00Z',
    addresses: null,
    contacts: null,
    ...overrides,
  };
}
