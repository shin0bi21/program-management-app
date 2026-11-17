import type { AccessTokenPayload } from '../types/auth';
import { ForbiddenError, NotFoundError } from '../errors';
import { sql } from '../db/client';

/**
 * Restricts records to the user's programs, preserving administrator/manager breadth.
 * @example sql`WHERE ${programAccessPredicate(user, sql`session.program_id`)}`
 */
export function programAccessPredicate(
  user: AccessTokenPayload,
  programId: ReturnType<typeof sql>,
) {
  if (hasGlobalProgramAccess(user)) return sql`TRUE`;

  return sql`
    EXISTS (
      SELECT 1 FROM user_program_assignments scoped_assignment
      WHERE scoped_assignment.user_id = ${user.userId}
        AND scoped_assignment.program_id = ${programId}
    )
  `;
}

/**
 * Authorizes the program scope before checking whether the required program exists.
 * Route middleware owns the operation capability; denied scope is 403, authorized absence is 404.
 * @example assertProgramAccess(user, programId)
 */
export async function assertProgramAccess(user: AccessTokenPayload, programId: string) {
  await assertProgramScope(user, programId);

  const programs = await sql`SELECT 1 FROM programs WHERE id = ${programId} LIMIT 1`;
  if (!programs.length) throw new NotFoundError('Program not found');
}

/**
 * Authorizes the parent program before looking up its required cycle assignment.
 * @example assertProgramCycleAccess(assignedStaff, programId, missingCycleId) // 404
 */
export async function assertProgramCycleAccess(user: AccessTokenPayload, programId: string, cycleId: string) {
  await assertProgramScope(user, programId);

  const assignments = await sql`
    SELECT 1 FROM program_cycle_assignments
    WHERE program_id = ${programId} AND cycle_id = ${cycleId}
    LIMIT 1
  `;
  if (!assignments.length) throw new NotFoundError('Program cycle not found');
}

/**
 * Authorizes a session through its program scope. A missing flat-ID target has no
 * discoverable parent: global program readers get 404; scoped users retain 403.
 * Route middleware owns the requested operation's capability.
 * @example assertSessionAccess(admin, missingSessionId) // 404
 */
export async function assertSessionAccess(user: AccessTokenPayload, sessionId: string) {
  const hasCollectionAccess = hasGlobalProgramAccess(user);
  const sessions = await sql`
    SELECT 1 FROM program_sessions cs
    WHERE cs.id = ${sessionId}
      AND ${programAccessPredicate(user, sql`cs.program_id`)}
    LIMIT 1
  `;
  if (sessions.length) return;
  if (hasCollectionAccess) throw new NotFoundError('Session not found');
  throw new ForbiddenError('You do not have access to this session');
}

/**
 * Establishes authority from the program assignment without probing target existence.
 * @example assertProgramScope(unassignedStaff, programId) // 403 even if the program is missing
 */
async function assertProgramScope(user: AccessTokenPayload, programId: string) {
  if (hasGlobalProgramAccess(user)) return;

  const [scope] = await sql<{ allowed: boolean }[]>`
    SELECT ${programAccessPredicate(user, sql`${programId}::uuid`)} AS allowed
  `;
  if (!scope.allowed) throw new ForbiddenError('You do not have access to this program');
}

/** Checks existing global program authority, independently of route capability.
 * @example hasGlobalProgramAccess(projectManager) // true
 */
function hasGlobalProgramAccess(user: AccessTokenPayload): boolean {
  return user.role === 'admin' || user.role === 'project_manager';
}
