import crypto from 'crypto';
import { asTransactionSql, sql } from '../db/client';
import { NotFoundError } from '../errors';
import { programAccessPredicate } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type { Schools, Users, YouthProfiles } from '../types/database';
import type { DbRow } from '../types/db';
import type { YouthQuery } from '../validation/youthSchemas';
import { audit } from './auditService';
import { setAddresses } from './addressService';
import { setContacts } from './contactService';
import { applyYouthFilters } from './queryFilters/youthFilters';

type YouthRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'created_at'>> &
  DbRow<Pick<YouthProfiles, 'date_of_birth' | 'school_id' | 'grade_level' | 'age_group'>> &
  DbRow<Pick<Schools, 'name'>> & {
    status: 'active' | 'inactive';
    cohorts: Array<{
      id: string;
      name: string;
      programId: string;
      programName: string;
      rosterMode: 'enrolled' | 'open';
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
  };

// ============================================================================
// QUERIES
// ============================================================================

export function getYouth(id: string): Promise<YouthRow | null>;
export function getYouth(id?: undefined, filters?: YouthQuery): Promise<YouthRow[]>;
export async function getYouth(id?: string, filters?: YouthQuery): Promise<YouthRow[] | YouthRow | null> {
  const where = filters ? applyYouthFilters(filters) : sql`TRUE`;
  const youth = await sql<YouthRow[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      CASE WHEN EXISTS (
        SELECT 1
        FROM cohort_enrollments current_enrollment
        INNER JOIN program_cohorts current_cohort
          ON current_cohort.id = current_enrollment.cohort_id
        WHERE current_enrollment.youth_id = u.id
          AND current_enrollment.enrolled_on <= (NOW() AT TIME ZONE 'America/Toronto')::date
          AND (
            current_enrollment.withdrawn_on IS NULL
            OR current_enrollment.withdrawn_on > (NOW() AT TIME ZONE 'America/Toronto')::date
          )
          AND (NOW() AT TIME ZONE 'America/Toronto')::date
            BETWEEN current_cohort.starts_on AND current_cohort.ends_on
      ) THEN 'active' ELSE 'inactive' END AS status,
      yp.date_of_birth,
      yp.school_id,
      s.name as school_name,
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
            'name', pc.name,
            'programId', p.id,
            'programName', p.name,
            'rosterMode', p.roster_mode,
            'startsOn', pc.starts_on,
            'endsOn', pc.ends_on,
            'enrolledOn', participation.enrolled_on,
            'withdrawnOn', participation.withdrawn_on,
            'presentCount', attendance.present_count,
            'lateCount', attendance.late_count,
            'absentCount', attendance.absent_count,
            'lastAttendedOn', attendance.last_attended_on
          )
          ORDER BY pc.starts_on DESC
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
            AND open_program.roster_mode = 'open'
            AND NOT EXISTS (
              SELECT 1
              FROM cohort_enrollments existing_enrollment
              WHERE existing_enrollment.cohort_id = open_cs.cohort_id
                AND existing_enrollment.youth_id = u.id
            )
          GROUP BY open_cs.cohort_id
        ) participation
        INNER JOIN program_cohorts pc ON pc.id = participation.cohort_id
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
      ) as addresses,
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
      ) as contacts
    FROM youth_profiles yp
    INNER JOIN users u ON u.id = yp.user_id
    INNER JOIN user_roles ur ON ur.id = u.role_id
    LEFT JOIN schools s ON s.id = yp.school_id
    LEFT JOIN user_credentials uc ON uc.user_id = u.id
    WHERE ur.name = 'youth'
      ${id ? sql`AND u.id = ${id}` : sql``}
      AND ${where}
    ORDER BY u.first_name ASC, u.last_name ASC
  `;
  return id ? youth[0] || null : youth;
}

export async function getYouthSessionNotes(
  youthId: string,
  actor: AccessTokenPayload,
) {
  const profiles = await sql`
    SELECT 1
    FROM youth_profiles
    WHERE user_id = ${youthId}
    LIMIT 1
  `;
  if (!profiles.length) throw new NotFoundError('Youth profile not found');

  return sql`
    SELECT
      sn.id,
      sn.session_id,
      sn.category,
      sn.title,
      sn.details,
      sn.created_at,
      sn.updated_at,
      CONCAT_WS(' ', author.first_name, author.last_name) AS created_by_name,
      cs.theme AS session_theme,
      cs.starts_at,
      pc.id AS cohort_id,
      pc.name AS cohort_name,
      p.id AS program_id,
      p.name AS program_name,
      p.roster_mode,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'youthId', linked_youth.id,
            'firstName', linked_youth.first_name,
            'lastName', linked_youth.last_name
          )
          ORDER BY linked_youth.first_name, linked_youth.last_name
        ) FILTER (WHERE linked_youth.id IS NOT NULL),
        '[]'::json
      ) AS youth
    FROM session_notes sn
    INNER JOIN session_note_has_youth selected_youth
      ON selected_youth.note_id = sn.id
      AND selected_youth.youth_id = ${youthId}
    INNER JOIN cohort_sessions cs ON cs.id = sn.session_id
    INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
    INNER JOIN programs p ON p.id = pc.program_id
    LEFT JOIN users author ON author.id = sn.created_by
    LEFT JOIN session_note_has_youth linked_note ON linked_note.note_id = sn.id
    LEFT JOIN users linked_youth ON linked_youth.id = linked_note.youth_id
    WHERE ${programAccessPredicate(actor, sql`p.id`)}
    GROUP BY sn.id, author.id, cs.id, pc.id, p.id
    ORDER BY cs.starts_at DESC, sn.created_at DESC
  `;
}

export interface SetYouthInput {
  id?: string;
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth?: string;
  schoolId?: string;
  gradeLevel?: number;
  addresses?: Array<{ id?: string; address: string }>;
  contacts?: Array<{ id?: string; phoneNumber: string; type: string }>;
}

export async function setYouth(data: SetYouthInput, actorId: string) {
  const { id, firstName, lastName, dateOfBirth, schoolId, gradeLevel, addresses, contacts } = data;
  const ageGroup = gradeLevel != null ? (gradeLevel <= 5 ? 'junior_youth' : 'senior_youth') : null;
  const transactionId = crypto.randomUUID();

  const userId = await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    let persistedUserId: string;

    if (id) {
      const existingUsers = await trx<DbRow<Pick<Users, 'id' | 'first_name' | 'last_name'>>[]>`
        SELECT id, first_name, last_name
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `;
      const existingProfiles = await trx<DbRow<Pick<YouthProfiles, 'user_id' | 'date_of_birth' | 'school_id' | 'grade_level' | 'age_group'>>[]>`
        SELECT user_id, date_of_birth, school_id, grade_level, age_group
        FROM youth_profiles
        WHERE user_id = ${id}
        LIMIT 1
      `;

      const users = await trx<DbRow<Users>[]>`
        INSERT INTO users (id, first_name, last_name, role_id, created_at, updated_at)
        VALUES (
          ${id},
          ${firstName},
          ${lastName},
          (SELECT id FROM user_roles WHERE name = 'youth'),
          COALESCE((SELECT created_at FROM users WHERE id = ${id}), NOW()),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;

      persistedUserId = users[0].id;
      await audit(
        trx,
        actorId,
        transactionId,
        'users',
        persistedUserId,
        existingUsers.length > 0 ? 'UPDATE' : 'INSERT',
        existingUsers[0]
          ? { id: existingUsers[0].id, firstName: existingUsers[0].firstName, lastName: existingUsers[0].lastName }
          : null,
        { id: users[0].id, firstName: users[0].firstName, lastName: users[0].lastName },
      );

      await trx`
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id, grade_level, age_group, created_at, updated_at)
        VALUES (
          ${persistedUserId},
          ${dateOfBirth || null},
          ${schoolId || null},
          ${gradeLevel ?? null},
          ${ageGroup},
          COALESCE((SELECT created_at FROM youth_profiles WHERE user_id = ${persistedUserId}), NOW()),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          date_of_birth = EXCLUDED.date_of_birth,
          school_id = EXCLUDED.school_id,
          grade_level = EXCLUDED.grade_level,
          age_group = EXCLUDED.age_group,
          updated_at = EXCLUDED.updated_at
      `;
      await audit(
        trx,
        actorId,
        transactionId,
        'youth_profiles',
        persistedUserId,
        existingProfiles.length > 0 ? 'UPDATE' : 'INSERT',
        existingProfiles[0]
          ? {
              userId: existingProfiles[0].userId,
              dateOfBirth: existingProfiles[0].dateOfBirth,
              schoolId: existingProfiles[0].schoolId,
              gradeLevel: existingProfiles[0].gradeLevel,
              ageGroup: existingProfiles[0].ageGroup,
            }
          : null,
        { userId: persistedUserId, dateOfBirth: dateOfBirth || null, schoolId: schoolId || null, gradeLevel: gradeLevel ?? null, ageGroup },
      );
    } else {
      const newUsers = await trx<DbRow<Users>[]>`
        INSERT INTO users (first_name, last_name, role_id)
        VALUES (${firstName}, ${lastName}, (SELECT id FROM user_roles WHERE name = 'youth'))
        RETURNING *
      `;

      persistedUserId = newUsers[0].id;
      await audit(trx, actorId, transactionId, 'users', persistedUserId, 'INSERT', null, { id: newUsers[0].id, firstName: newUsers[0].firstName, lastName: newUsers[0].lastName });

      await trx`
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id, grade_level, age_group)
        VALUES (${persistedUserId}, ${dateOfBirth || null}, ${schoolId || null}, ${gradeLevel ?? null}, ${ageGroup})
      `;
      await audit(trx, actorId, transactionId, 'youth_profiles', persistedUserId, 'INSERT', null, { userId: persistedUserId, dateOfBirth: dateOfBirth || null, schoolId: schoolId || null, gradeLevel: gradeLevel ?? null, ageGroup });
    }

    if (id) {
      await setAddresses(persistedUserId, addresses || [], actorId, transactionId, trx);
      await setContacts(persistedUserId, contacts || [], actorId, transactionId, trx);
    } else {
      if (addresses && addresses.length > 0) await setAddresses(persistedUserId, addresses, actorId, transactionId, trx);
      if (contacts && contacts.length > 0) await setContacts(persistedUserId, contacts, actorId, transactionId, trx);
    }

    return persistedUserId;
  });

  const savedYouth = await getYouth(userId);
  if (!savedYouth) throw new NotFoundError('Saved youth profile not found');
  return savedYouth;
}
