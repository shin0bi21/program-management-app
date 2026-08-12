import { sql } from '../db/client';
import type { AccessTokenPayload } from '../types/auth';

export function sharedStaffResourceReadPredicate(
  actor: AccessTokenPayload,
  staffId: ReturnType<typeof sql>,
) {
  if (actor.role === 'admin') return sql`TRUE`;
  return sql`(
    ${staffId} = ${actor.userId}
    OR EXISTS (
      SELECT 1
      FROM user_program_assignments actor_program
      INNER JOIN user_program_assignments resource_program
        ON resource_program.program_id = actor_program.program_id
      WHERE actor_program.user_id = ${actor.userId}
        AND resource_program.user_id = ${staffId}
    )
  )`;
}
