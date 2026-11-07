import type { SessionType } from '../../../types/programming';
import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

/** Session details shared by table, calendar, and mutation responses. */
export interface SessionRow {
  id: string;
  theme: string;
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
  description: string | null;
  cycleId: string;
  sessionType: SessionType;

  cycle: string;

  programId: string;
  program: string;
  enrollmentRequired: boolean;

  state: 'upcoming' | 'completed' | 'cancelled';
}

/**
 * Builds rows for table and calendar items.
 * @param actor - User requesting the rows.
 * @param query - Database client; pass trx inside a transaction.
 * @example getSessionRows(actor, trx)
 */
export function getSessionRows(
  actor: AccessTokenPayload,
  query = sql,
) {
  return query<SessionRow[]>`
    SELECT
      session.id,
      session.theme,
      session.starts_at,
      session.ends_at,
      session.cancelled_at,
      session.description,
      session.cycle_id,
      session.session_type,

      cycle.name AS cycle,

      program.id AS program_id,
      program.name AS program,
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
