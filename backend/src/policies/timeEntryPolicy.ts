import { sql } from '../db/client';
import { ForbiddenError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import { sharedStaffResourceReadPredicate } from './staffResourcePolicy';

export function timeEntryWriteScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  if (!actor.permissions.includes('write:timesheets')) return sql`FALSE`;
  return actor.role === 'admin' ? sql`TRUE` : sql`${staffId} = ${actor.userId}`;
}

export function canSetTimeEntry(actor: AccessTokenPayload, staffId: string) {
  return actor.permissions.includes('write:timesheets')
    && (actor.role === 'admin' || actor.userId === staffId);
}

export function timeEntryResourceReadScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  return sharedStaffResourceReadPredicate(actor, staffId);
}

export function timeEntryReadScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  return timeEntryResourceReadScopePredicate(actor, staffId);
}

export function assertCanSetTimeEntry(actor: AccessTokenPayload, staffId: string) {
  if (!canSetTimeEntry(actor, staffId)) {
    throw new ForbiddenError('Staff can only manage their own time entries');
  }
}
