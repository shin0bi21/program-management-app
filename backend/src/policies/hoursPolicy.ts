import { sql } from '../db/client';
import { ForbiddenError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import { sharedStaffResourceReadPredicate } from './staffResourcePolicy';

export function hoursWriteScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  if (!actor.permissions.includes('write:hours')) return sql`FALSE`;
  return actor.role === 'admin' ? sql`TRUE` : sql`${staffId} = ${actor.userId}`;
}

export function canSetHours(actor: AccessTokenPayload, staffId: string) {
  return actor.permissions.includes('write:hours')
    && (actor.role === 'admin' || actor.userId === staffId);
}

export function hoursResourceReadScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  return sharedStaffResourceReadPredicate(actor, staffId);
}

export function hoursReadScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  return hoursResourceReadScopePredicate(actor, staffId);
}

export function assertCanSetHours(actor: AccessTokenPayload, staffId: string) {
  if (!canSetHours(actor, staffId)) {
    throw new ForbiddenError('Staff can only manage their own time entries');
  }
}
