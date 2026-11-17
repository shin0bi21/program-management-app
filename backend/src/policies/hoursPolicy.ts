import { sql } from '../db/client';
import { ForbiddenError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import { sharedStaffReadPredicate } from './staffPolicy';

/** Allows hours writes for administrators or the actor when write access is granted. @example hoursWriteScopePredicate(actor, sql`entry.staff_id`) */
export function hoursWriteScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  if (!actor.permissions.includes('write:hours')) return sql`FALSE`;
  return actor.role === 'admin' ? sql`TRUE` : sql`${staffId} = ${actor.userId}`;
}

/** Checks hours write access for a staff member. @example canSetHours(actor, actor.userId) */
export function canSetHours(actor: AccessTokenPayload, staffId: string) {
  return actor.permissions.includes('write:hours')
    && (actor.role === 'admin' || actor.userId === staffId);
}

/** Supplies staff visibility for hours workflows. @example hoursStaffReadScopePredicate(actor, sql`staff.id`) */
export function hoursStaffReadScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  return sharedStaffReadPredicate(actor, staffId);
}

/** Restricts hours records to readable staff. @example hoursReadScopePredicate(actor, sql`entry.staff_id`) */
export function hoursReadScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  return hoursStaffReadScopePredicate(actor, staffId);
}

/** Rejects writes outside the actor's hours scope. @example assertHoursWriteAccess(actor, staffId) // throws 403 when forbidden */
export function assertHoursWriteAccess(actor: AccessTokenPayload, staffId: string) {
  if (!canSetHours(actor, staffId)) {
    throw new ForbiddenError('Staff can only manage their own logged hours');
  }
}
