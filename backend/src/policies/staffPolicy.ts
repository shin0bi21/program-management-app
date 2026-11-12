import { sql } from '../db/client';
import type { AccessTokenPayload } from '../types/auth';

/**
 * Allows administrators, the actor, and staff sharing a program with the actor.
 * @param actor - Signed-in user whose role and program assignments define visibility.
 * @param staffId - SQL expression identifying the staff member being checked.
 * @example sharedStaffReadPredicate(actor, sql`staff.id`) // staff visibility condition
 */
export function sharedStaffReadPredicate(
  actor: AccessTokenPayload,
  staffId: ReturnType<typeof sql>,
) {
  if (actor.role === 'admin') return sql`TRUE`;
  return sql`(
    ${staffId} = ${actor.userId}
    OR EXISTS (
      SELECT 1
      FROM user_program_assignments actor_program
      INNER JOIN user_program_assignments staff_program
        ON staff_program.program_id = actor_program.program_id
      WHERE actor_program.user_id = ${actor.userId}
        AND staff_program.user_id = ${staffId}
    )
  )`;
}
