import { sql } from '../db/client';
import { ForbiddenError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import { sharedStaffReadPredicate } from './staffPolicy';

/** Allows hours writes for administrators or the user when write access is granted. @example hoursWriteScopePredicate(user, sql`entry.staff_id`) */
export function hoursWriteScopePredicate(user: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  if (!user.permissions.includes('write:hours')) return sql`FALSE`;
  return user.role === 'admin' ? sql`TRUE` : sql`${staffId} = ${user.userId}`;
}

/** Checks hours write access for a staff member. @example canSetHours(user, user.userId) */
export function canSetHours(user: AccessTokenPayload, staffId: string) {
  return user.permissions.includes('write:hours')
    && (user.role === 'admin' || user.userId === staffId);
}

/** Supplies staff visibility for hours workflows. @example hoursStaffReadScopePredicate(user, sql`staff.id`) */
export function hoursStaffReadScopePredicate(user: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  return sharedStaffReadPredicate(user, staffId);
}

/** Restricts hours records to readable staff. @example hoursReadScopePredicate(user, sql`entry.staff_id`) */
export function hoursReadScopePredicate(user: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  return hoursStaffReadScopePredicate(user, staffId);
}

/** Rejects writes outside the user's hours scope. @example assertHoursWriteAccess(user, staffId) // throws 403 when forbidden */
export function assertHoursWriteAccess(user: AccessTokenPayload, staffId: string) {
  if (!canSetHours(user, staffId)) {
    throw new ForbiddenError('Staff can only manage their own logged hours');
  }
}
