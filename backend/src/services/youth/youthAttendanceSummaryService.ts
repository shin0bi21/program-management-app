import { sql } from '../../db/client';
import { NotFoundError } from '../../errors';
import { programAccessPredicate } from '../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../types/auth';

export interface YouthAttendanceSummary {
  cycleId: string;
  cycle: string;
  startsOn: string;
  endsOn: string;

  programId: string;
  program: string;
  enrollmentRequired: boolean;

  enrolledOn: string | null;
  withdrawnOn: string | null;

  presentCount: number;
  lateCount: number;
  absentCount: number;
}

/**
 * Loads attendance totals for the selected youth's enrollments and open-program visits.
 * @param youthId - Youth ID selected in the dashboard; a missing profile produces a 404 error.
 * @param actor - Signed-in user whose program scope limits the returned summaries.
 * @returns One summary per visible program and cycle, including enrollments with no attendance.
 * @example getYouthAttendanceSummary(youthId, actor) // attendance dashboard rows
 */
export async function getYouthAttendanceSummary(youthId: string, actor: AccessTokenPayload) {
  // 1. Require the selected youth profile.
  const profiles = await sql`
    SELECT profile.user_id
    FROM youth_profiles profile
    INNER JOIN users youth ON youth.id = profile.user_id
    INNER JOIN user_roles role ON role.id = youth.role_id
    WHERE profile.user_id = ${youthId} AND role.name = 'youth'
  `;
  if (!profiles.length) throw new NotFoundError('Youth profile not found');

  // 2. Summarize enrollment and open-program attendance within the actor's program scope.
  return sql<YouthAttendanceSummary[]>`
    SELECT
      cycle.id AS cycle_id,
      cycle.name AS cycle,
      cycle.starts_on::text AS starts_on,
      cycle.ends_on::text AS ends_on,

      program.id AS program_id,
      program.name AS program,
      program.enrollment_required,

      participation.enrolled_on::text AS enrolled_on,
      participation.withdrawn_on::text AS withdrawn_on,

      attendance.present_count,
      attendance.late_count,
      attendance.absent_count
    FROM (
      SELECT
        enrollment.program_id,
        enrollment.cycle_id,
        enrollment.enrolled_on,
        enrollment.withdrawn_on
      FROM program_enrollments enrollment
      WHERE enrollment.youth_id = ${youthId}

      -- Also include attendance at programs that do not require enrollment.
      -- Exclude program/cycle pairs already represented by an enrollment.
      UNION ALL

      SELECT
        open_session.program_id,
        open_session.cycle_id,
        NULL::date AS enrolled_on,
        NULL::date AS withdrawn_on
      FROM attendance_records open_attendance
      INNER JOIN program_sessions open_session ON open_session.id = open_attendance.session_id
      INNER JOIN programs open_program ON open_program.id = open_session.program_id
      WHERE open_attendance.youth_id = ${youthId}
        AND open_program.enrollment_required = FALSE
        AND NOT EXISTS (
          SELECT 1
          FROM program_enrollments existing_enrollment
          WHERE existing_enrollment.program_id = open_session.program_id
            AND existing_enrollment.cycle_id = open_session.cycle_id
            AND existing_enrollment.youth_id = ${youthId}
        )
      GROUP BY open_session.program_id, open_session.cycle_id
    ) participation
    INNER JOIN program_cycles cycle ON cycle.id = participation.cycle_id
    INNER JOIN programs program ON program.id = participation.program_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(attendance_record.id) FILTER (WHERE attendance_record.status = 'present')::int AS present_count,
        COUNT(attendance_record.id) FILTER (WHERE attendance_record.status = 'late')::int AS late_count,
        COUNT(attendance_record.id) FILTER (WHERE attendance_record.status = 'absent')::int AS absent_count
      FROM program_sessions session
      INNER JOIN attendance_records attendance_record
        ON attendance_record.session_id = session.id
        AND attendance_record.youth_id = ${youthId}
      WHERE session.program_id = participation.program_id AND session.cycle_id = participation.cycle_id
    ) attendance ON TRUE
    WHERE ${programAccessPredicate(actor, sql`program.id`)}
    ORDER BY cycle.starts_on DESC, program.name, cycle.id
  `;
}
