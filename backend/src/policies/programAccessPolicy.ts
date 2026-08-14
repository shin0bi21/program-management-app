import type { AccessTokenPayload } from '../types/auth';
import { ForbiddenError } from '../errors';
import { sql } from '../db/client';

export function programAccessPredicate(
  actor: AccessTokenPayload,
  programId: ReturnType<typeof sql>,
) {
  if (actor.role === 'admin') return sql`TRUE`;

  return sql`
    EXISTS (
      SELECT 1
      FROM programs scoped_program
      WHERE scoped_program.id = ${programId}
        AND (
          scoped_program.roster_mode = 'open'
          OR EXISTS (
            SELECT 1
            FROM user_program_assignments scoped_assignment
            WHERE scoped_assignment.user_id = ${actor.userId}
              AND scoped_assignment.program_id = scoped_program.id
          )
        )
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

export async function assertCanAccessCohort(actor: AccessTokenPayload, cohortId: string) {
  const rows = await sql`
    SELECT 1
    FROM program_cohorts pc
    WHERE pc.id = ${cohortId}
      AND ${programAccessPredicate(actor, sql`pc.program_id`)}
    LIMIT 1
  `;
  if (!rows.length) throw new ForbiddenError('You do not have access to this cohort');
}

export async function assertCanAccessSession(actor: AccessTokenPayload, sessionId: string) {
  const rows = await sql`
    SELECT 1
    FROM cohort_sessions cs
    INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
    WHERE cs.id = ${sessionId}
      AND ${programAccessPredicate(actor, sql`pc.program_id`)}
    LIMIT 1
  `;
  if (!rows.length) throw new ForbiddenError('You do not have access to this session');
}
