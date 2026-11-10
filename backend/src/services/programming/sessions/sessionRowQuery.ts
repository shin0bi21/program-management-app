import type { SessionType } from '../../../types/programming';
import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

/** Session details shared by table, calendar, and mutation responses. */
export interface SessionRow {
  id: string;
  theme: string;
  date: string;
  startTime: string;
  endTime: string;
  cancelledAt: Date | null;
  description: string | null;
  cycleId: string;
  sessionType: SessionType;

  cycle: string;

  programId: string;
  program: string;
  enrollmentRequired: boolean;

  state: 'upcoming' | 'completed' | 'cancelled';
  movable: boolean;
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
      session.date::text,
      to_char(session.start_time, 'HH24:MI') AS start_time,
      to_char(session.end_time, 'HH24:MI') AS end_time,
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
        WHEN (session.date + session.end_time) < (NOW() AT TIME ZONE 'America/Toronto') THEN 'completed'
        ELSE 'upcoming'
      END AS state,
      session.cancelled_at IS NULL
        AND (session.date + session.start_time) > (NOW() AT TIME ZONE 'America/Toronto') AS movable
    FROM program_sessions session
    INNER JOIN program_cycles cycle ON cycle.id = session.cycle_id
    INNER JOIN programs program ON program.id = session.program_id
    WHERE ${programAccessPredicate(actor, query`session.program_id`)}
  `;
}
