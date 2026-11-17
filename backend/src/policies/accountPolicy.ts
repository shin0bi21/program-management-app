import type { AccessTokenPayload, UserRole } from '../types/auth';
import { ForbiddenError } from '../errors';
import { sql } from '../db/client';

export function accountAccessPredicate(user: AccessTokenPayload, targetRole: ReturnType<typeof sql>) {
  return user.role === 'admin' ? sql`TRUE` : sql`${targetRole} = 'youth'`;
}

export function assertAccountCreationAccess(user: AccessTokenPayload, role: UserRole) {
  if (user.role !== 'admin' || !['admin', 'project_manager', 'staff'].includes(role)) {
    throw new ForbiddenError('Insufficient permissions for this account');
  }
}

export function assertAccountManagementAccess(user: AccessTokenPayload, targetRole: UserRole) {
  if (user.role === 'admin') return;
  if (['staff', 'project_manager'].includes(user.role) && targetRole === 'youth') return;
  throw new ForbiddenError('Insufficient permissions for this account');
}
