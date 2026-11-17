import { sql } from '../db/client';
import { ForbiddenError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import { sharedStaffReadPredicate } from './staffPolicy';

/** Allows task writes for administrators or the actor when write access is granted. @example taskWriteScopePredicate(actor, sql`task.staff_id`) */
export function taskWriteScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  if (!actor.permissions.includes('write:tasks')) return sql`FALSE`;
  return actor.role === 'admin' ? sql`TRUE` : sql`${staffId} = ${actor.userId}`;
}

/** Checks task write access for a staff member. @example canWriteTaskFor(actor, actor.userId) */
export function canWriteTaskFor(actor: AccessTokenPayload, staffId: string) {
  return actor.permissions.includes('write:tasks')
    && (actor.role === 'admin' || actor.userId === staffId);
}

/** Restricts task records to readable staff. @example taskReadScopePredicate(actor, sql`task.staff_id`) */
export function taskReadScopePredicate(
  actor: AccessTokenPayload,
  staffId: ReturnType<typeof sql>,
) {
  return taskStaffReadScopePredicate(actor, staffId);
}

/** Supplies staff visibility for task workflows. @example taskStaffReadScopePredicate(actor, sql`staff.id`) */
export function taskStaffReadScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  return sharedStaffReadPredicate(actor, staffId);
}

/** Rejects assignments outside the actor's task write scope. @example assertTaskWriteAccess(actor, staffId) // throws 403 when forbidden */
export function assertTaskWriteAccess(actor: AccessTokenPayload, staffId: string) {
  if (!canWriteTaskFor(actor, staffId)) {
    throw new ForbiddenError('Staff can only manage their own tasks');
  }
}
