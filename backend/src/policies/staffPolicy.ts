import { sql } from '../db/client';
import type { AccessTokenPayload } from '../types/auth';

/**
 * Allows administrators, the user, and staff sharing a program with the user.
 * @param user - Signed-in user whose role and program assignments define visibility.
 * @param staffId - SQL expression identifying the staff member being checked.
 * @example sharedStaffReadPredicate(user, sql`staff.id`) // staff visibility condition
 */
export function sharedStaffReadPredicate(
  user: AccessTokenPayload,
  staffId: ReturnType<typeof sql>,
) {
  if (user.role === 'admin') return sql`TRUE`;
  return sql`(
    ${staffId} = ${user.userId}
    OR EXISTS (
      SELECT 1
      FROM user_program_assignments user_program
      INNER JOIN user_program_assignments staff_program
        ON staff_program.program_id = user_program.program_id
      WHERE user_program.user_id = ${user.userId}
        AND staff_program.user_id = ${staffId}
    )
  )`;
}
