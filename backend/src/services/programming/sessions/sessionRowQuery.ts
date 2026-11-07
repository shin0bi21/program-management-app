import type { SessionType } from '../../../types/programming';
import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

/** Session details shared by table, calendar, and mutation responses. */
export interface ProgramSessionRow {
  id: string;
  theme: string;
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
  description: string | null;
  cycleId: string;
  sessionType: SessionType;

  cycleName: string;

  programId: string;
  programName: string;
  enrollmentRequired: boolean;

  state: 'upcoming' | 'completed' | 'cancelled';
}

/**
 * Builds complete, accessible session rows for composition or direct execution.
 * Missing and out-of-scope sessions are omitted; route permissions belong to callers.
 * @param actor - Actor whose program access scopes the returned sessions.
 * @param query - Defaults to the shared client; pass trx to join an existing transaction.
 * @returns A composable query; awaiting it loads rows using the client's camelCase transformation.
 * @example getSessionRows(actor, trx) // composable rows using the existing transaction
 * @example sql`SELECT * FROM (${getSessionRows(actor)}) session WHERE session.theme ILIKE ${search}`
 */
export function getSessionRows(
  actor: AccessTokenPayload,
  query = sql,
) {
  // 1. Build complete session rows within the actor's program scope.
  return query<ProgramSessionRow[]>`
    SELECT
      session.id,
      session.theme,
      session.starts_at,
      session.ends_at,
      session.cancelled_at,
      session.description,
      session.cycle_id,
      session.session_type,

      cycle.name AS cycle_name,

      program.id AS program_id,
      program.name AS program_name,
      program.enrollment_required,

      CASE
        WHEN session.cancelled_at IS NOT NULL THEN 'cancelled'
        WHEN session.ends_at < NOW() THEN 'completed'
        ELSE 'upcoming'
      END AS state
    FROM program_sessions session
    INNER JOIN program_cycles cycle ON cycle.id = session.cycle_id
    INNER JOIN programs program ON program.id = session.program_id
    WHERE ${programAccessPredicate(actor, query`session.program_id`)}
  `;
}
