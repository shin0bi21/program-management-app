import type { AccessTokenPayload, UserRole } from '../types/auth';
import { ForbiddenError } from '../errors';
import { sql } from '../db/client';

export function accountAccessPredicate(actor: AccessTokenPayload, targetRole: ReturnType<typeof sql>) {
  return actor.role === 'admin' ? sql`TRUE` : sql`${targetRole} = 'youth'`;
}

export function assertAccountCreationAccess(actor: AccessTokenPayload, role: UserRole) {
  if (actor.role !== 'admin' || !['admin', 'project_manager', 'staff'].includes(role)) {
    throw new ForbiddenError('Insufficient permissions for this account');
  }
}

export function assertAccountManagementAccess(actor: AccessTokenPayload, targetRole: UserRole) {
  if (actor.role === 'admin') return;
  if (['staff', 'project_manager'].includes(actor.role) && targetRole === 'youth') return;
  throw new ForbiddenError('Insufficient permissions for this account');
}
