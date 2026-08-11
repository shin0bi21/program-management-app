import { sql } from '../db/client';
import { ForbiddenError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import { sharedStaffResourceReadPredicate } from './staffResourcePolicy';

export function taskWriteScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  if (!actor.permissions.includes('write:tasks')) return sql`FALSE`;
  return actor.role === 'admin' ? sql`TRUE` : sql`${staffId} = ${actor.userId}`;
}

export function canWriteTaskFor(actor: AccessTokenPayload, staffId: string) {
  return actor.permissions.includes('write:tasks')
    && (actor.role === 'admin' || actor.userId === staffId);
}

export function taskReadScopePredicate(
  actor: AccessTokenPayload,
  staffId: ReturnType<typeof sql>,
) {
  return taskResourceReadScopePredicate(actor, staffId);
}

export function taskResourceReadScopePredicate(actor: AccessTokenPayload, staffId: ReturnType<typeof sql>) {
  return sharedStaffResourceReadPredicate(actor, staffId);
}

export function assertCanAssignTaskTo(actor: AccessTokenPayload, staffId: string) {
  if (!canWriteTaskFor(actor, staffId)) {
    throw new ForbiddenError('Staff can only manage their own tasks');
  }
}
