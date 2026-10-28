import { sql } from '../../db/client';
import type { Schools, Users, YouthProfiles } from '../../types/database';
import type { DbRow } from '../../types/db';

export type YouthRecordRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'created_at'>> &
  DbRow<Pick<YouthProfiles, 'date_of_birth' | 'school_id' | 'grade_level' | 'age_group'>> &
  DbRow<Pick<Schools, 'name'>> & {
    status: 'active' | 'inactive';
    cohorts: Array<{
      id: string;
      name: string;
      programId: string;
      programName: string;
      enrollmentRequired: boolean;
      startsOn: string;
      endsOn: string;
      enrolledOn: string | null;
      withdrawnOn: string | null;
      presentCount: number;
      lateCount: number;
      absentCount: number;
      lastAttendedOn: string | null;
    }>;
    account: { email: string; status: 'invited' | 'active' | 'inactive' } | null;
    lastAttendedOn: string | null;
    addresses: Array<{ id: string; address: string }> | null;
    contacts: Array<{ id: string; phoneNumber: string; type: string }> | null;
  };

export const youthActiveStatus = sql`CASE WHEN EXISTS (
  SELECT 1 FROM cohort_enrollments current_enrollment
  INNER JOIN program_cohorts current_cohort ON current_cohort.id = current_enrollment.cohort_id
  INNER JOIN program_cycles current_cycle ON current_cycle.id = current_cohort.cycle_id
  WHERE current_enrollment.youth_id = u.id
    AND current_enrollment.enrolled_on <= (NOW() AT TIME ZONE 'America/Toronto')::date
    AND (current_enrollment.withdrawn_on IS NULL OR current_enrollment.withdrawn_on > (NOW() AT TIME ZONE 'America/Toronto')::date)
    AND (NOW() AT TIME ZONE 'America/Toronto')::date BETWEEN current_cycle.starts_on AND current_cycle.ends_on
) THEN 'active' ELSE 'inactive' END`;

export const youthRecordColumns = sql`
  u.id,
  u.first_name,
  u.last_name,
  ${youthActiveStatus} AS status,
  yp.date_of_birth,
  yp.school_id,
  s.name AS school_name,
  yp.grade_level,
  yp.age_group,
  CASE WHEN uc.user_id IS NULL THEN NULL ELSE json_build_object(
    'email', uc.email,
    'status', uc.status
  ) END AS account,
  (
    SELECT (MAX(cs.starts_at) AT TIME ZONE 'America/Toronto')::date::text
    FROM attendance_records ar
    INNER JOIN cohort_sessions cs ON cs.id = ar.session_id
    WHERE ar.youth_id = u.id
      AND ar.status IN ('present', 'late')
  ) AS last_attended_on,
  u.created_at,
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', pc.id,
        'name', cycle.name,
        'programId', p.id,
        'programName', p.name,
        'enrollmentRequired', p.enrollment_required,
        'startsOn', cycle.starts_on,
        'endsOn', cycle.ends_on,
        'enrolledOn', participation.enrolled_on,
        'withdrawnOn', participation.withdrawn_on,
        'presentCount', attendance.present_count,
        'lateCount', attendance.late_count,
        'absentCount', attendance.absent_count,
        'lastAttendedOn', attendance.last_attended_on
      )
      ORDER BY cycle.starts_on DESC
    )
    FROM (
      SELECT
        ce.cohort_id,
        ce.enrolled_on,
        ce.withdrawn_on
      FROM cohort_enrollments ce
      WHERE ce.youth_id = u.id

      UNION ALL

      SELECT
        open_cs.cohort_id,
        NULL::date AS enrolled_on,
        NULL::date AS withdrawn_on
      FROM attendance_records open_ar
      INNER JOIN cohort_sessions open_cs ON open_cs.id = open_ar.session_id
      INNER JOIN program_cohorts open_pc ON open_pc.id = open_cs.cohort_id
      INNER JOIN programs open_program ON open_program.id = open_pc.program_id
      WHERE open_ar.youth_id = u.id
        AND open_program.enrollment_required = FALSE
        AND NOT EXISTS (
          SELECT 1
          FROM cohort_enrollments existing_enrollment
          WHERE existing_enrollment.cohort_id = open_cs.cohort_id
            AND existing_enrollment.youth_id = u.id
        )
      GROUP BY open_cs.cohort_id
    ) participation
    INNER JOIN program_cohorts pc ON pc.id = participation.cohort_id
    INNER JOIN program_cycles cycle ON cycle.id = pc.cycle_id
    INNER JOIN programs p ON p.id = pc.program_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(ar.id) FILTER (WHERE ar.status = 'present')::int AS present_count,
        COUNT(ar.id) FILTER (WHERE ar.status = 'late')::int AS late_count,
        COUNT(ar.id) FILTER (WHERE ar.status = 'absent')::int AS absent_count,
        (
          MAX(cs.starts_at) FILTER (WHERE ar.status IN ('present', 'late'))
          AT TIME ZONE 'America/Toronto'
        )::date::text AS last_attended_on
      FROM cohort_sessions cs
      INNER JOIN attendance_records ar
        ON ar.session_id = cs.id
        AND ar.youth_id = u.id
      WHERE cs.cohort_id = pc.id
    ) attendance ON TRUE
  ), '[]'::json) AS cohorts,
  (
    SELECT json_agg(
      json_build_object(
        'id', a.id,
        'address', a.address
      )
    )
    FROM addresses a
    INNER JOIN user_has_addresses uha ON uha.address_id = a.id
    WHERE uha.user_id = u.id AND uha.active = true
  ) AS addresses,
  (
    SELECT json_agg(
      json_build_object(
        'id', c.id,
        'phoneNumber', c.phone_number,
        'type', c.type
      )
    )
    FROM contacts c
    INNER JOIN user_has_contacts uhc ON uhc.contact_id = c.id
    WHERE uhc.user_id = u.id AND uhc.active = true
  ) AS contacts
`;

export const youthRecordFrom = sql`
  FROM youth_profiles yp
  INNER JOIN users u ON u.id = yp.user_id
  INNER JOIN user_roles ur ON ur.id = u.role_id
  LEFT JOIN schools s ON s.id = yp.school_id
  LEFT JOIN user_credentials uc ON uc.user_id = u.id
`;
