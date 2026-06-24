import type { StaffUser } from '../../common/types/staff';

export function makeStaffUser(overrides: Partial<StaffUser> = {}): StaffUser {
  return {
    id: 'staff-1',
    firstName: 'Alice',
    lastName: 'Admin',
    email: 'alice@example.com',
    role: 'admin',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
