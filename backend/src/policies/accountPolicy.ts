import type { AccessTokenPayload, UserRole } from '../types/auth';
import { ForbiddenError } from '../errors';

export function assertCanCreateAccount(actor: AccessTokenPayload, role: UserRole) {
  if (actor.role !== 'admin' || !['admin', 'staff'].includes(role)) {
    throw new ForbiddenError('Insufficient permissions for this account');
  }
}

export function assertCanManageAccount(actor: AccessTokenPayload, targetRole: UserRole) {
  if (actor.role === 'admin') return;
  if (actor.role === 'staff' && targetRole === 'youth') return;
  throw new ForbiddenError('Insufficient permissions for this account');
}
