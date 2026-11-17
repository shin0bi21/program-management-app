import { sql } from '../db/client';
import { ForbiddenError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import { sharedStaffReadPredicate } from './staffPolicy';

/** Allows task writes for administrators or the user when write access is granted. @example taskWriteScopePredicate(user, sql`task.staff_id`) */
export function taskWriteScopePredicate(user: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  if (!user.permissions.includes('write:tasks')) return sql`FALSE`;
  return user.role === 'admin' ? sql`TRUE` : sql`${staffId} = ${user.userId}`;
}

/** Checks task write access for a staff member. @example canWriteTaskFor(user, user.userId) */
export function canWriteTaskFor(user: AccessTokenPayload, staffId: string) {
  return user.permissions.includes('write:tasks')
    && (user.role === 'admin' || user.userId === staffId);
}

/** Restricts task records to readable staff. @example taskReadScopePredicate(user, sql`task.staff_id`) */
export function taskReadScopePredicate(
  user: AccessTokenPayload,
  staffId: ReturnType<typeof sql>,
) {
  return taskStaffReadScopePredicate(user, staffId);
}

/** Supplies staff visibility for task workflows. @example taskStaffReadScopePredicate(user, sql`staff.id`) */
export function taskStaffReadScopePredicate(user: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  return sharedStaffReadPredicate(user, staffId);
}

/** Rejects assignments outside the user's task write scope. @example assertTaskWriteAccess(user, staffId) // throws 403 when forbidden */
export function assertTaskWriteAccess(user: AccessTokenPayload, staffId: string) {
  if (!canWriteTaskFor(user, staffId)) {
    throw new ForbiddenError('Staff can only manage their own tasks');
  }
}
