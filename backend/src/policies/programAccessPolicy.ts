import type { AccessTokenPayload } from '../types/auth';
import { ForbiddenError } from '../errors';
import { sql } from '../db/client';

export function programAccessPredicate(
  actor: AccessTokenPayload,
  programId: ReturnType<typeof sql>,
) {
  if (actor.role === 'admin' || actor.role === 'project_manager') return sql`TRUE`;

  return sql`
    EXISTS (
      SELECT 1 FROM user_program_assignments scoped_assignment
      WHERE scoped_assignment.user_id = ${actor.userId}
        AND scoped_assignment.program_id = ${programId}
    )
  `;
}

export async function assertCanAccessProgram(actor: AccessTokenPayload, programId: string) {
  const rows = await sql`
    SELECT 1
    FROM programs p
    WHERE p.id = ${programId}
      AND ${programAccessPredicate(actor, sql`p.id`)}
    LIMIT 1
  `;
  if (!rows.length) throw new ForbiddenError('You do not have access to this program');
}

export async function assertCanAccessProgramCycle(actor: AccessTokenPayload, programId: string, cycleId: string) {
  const rows = await sql`
    SELECT 1 FROM program_cycle_assignments assignment
    WHERE assignment.program_id = ${programId} AND assignment.cycle_id = ${cycleId}
      AND ${programAccessPredicate(actor, sql`assignment.program_id`)} LIMIT 1
  `;
  if (!rows.length) throw new ForbiddenError('You do not have access to this program cycle');
}

export async function assertCanAccessSession(actor: AccessTokenPayload, sessionId: string) {
  const rows = await sql`
    SELECT 1
    FROM program_sessions cs
    WHERE cs.id = ${sessionId}
      AND ${programAccessPredicate(actor, sql`cs.program_id`)}
    LIMIT 1
  `;
  if (!rows.length) throw new ForbiddenError('You do not have access to this session');
}
