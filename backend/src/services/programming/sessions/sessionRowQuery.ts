import type { SessionType } from '../../../types/programming';
import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

/** Session details shared by table, calendar, and mutation responses. */
export interface SessionRow {
  id: string;
  title: string;
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
 * @param user - User requesting the rows.
 * @param query - Database client; pass trx inside a transaction.
 * @example getSessionRows(user, trx)
 */
export function getSessionRows(
  user: AccessTokenPayload,
  query = sql,
) {
  return query<SessionRow[]>`
    SELECT
      session.id,
      session.title,
      session.date,
      to_char(session.start_time, 'HH24:MI') AS start_time,
      to_char(session.end_time, 'HH24:MI') AS end_time,
      session.cancelled_at,
      session.description,
      session.cycle_id,
      session.session_type,

      cycle.title AS cycle,

      program.id AS program_id,
      program.title AS program,
      program.enrollment_required,

      CASE
        WHEN session.cancelled_at IS NOT NULL THEN 'cancelled'
        WHEN session.date < CURRENT_DATE THEN 'completed'
        ELSE 'upcoming'
      END AS state,
      session.cancelled_at IS NULL
        AND session.date > CURRENT_DATE AS movable
    FROM program_sessions session
    INNER JOIN program_cycles cycle ON cycle.id = session.cycle_id
    INNER JOIN programs program ON program.id = session.program_id
    WHERE ${programAccessPredicate(user, query`session.program_id`)}
  `;
}
