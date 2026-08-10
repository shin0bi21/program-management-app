#!/usr/bin/env node

import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

const sql = postgres(databaseUrl);
const fixtureStaffId = '20000000-0000-4000-8000-000000000001';
const youthFixtures = [
  ['20000000-0000-4000-8000-000000000101', 'Maya', 'Thompson'],
  ['20000000-0000-4000-8000-000000000102', 'Noah', 'Williams'],
  ['20000000-0000-4000-8000-000000000103', 'Aaliyah', 'Brown'],
  ['20000000-0000-4000-8000-000000000104', 'Ethan', 'Davis'],
  ['20000000-0000-4000-8000-000000000105', 'Zoe', 'Wilson'],
] as const;

const sessionFixtures = [
  ['2026-07-07', 'Communication'],
  ['2026-07-14', 'Managing Anger'],
  ['2026-07-21', 'Conflict Resolution'],
  ['2026-07-28', 'Teamwork'],
  ['2026-08-04', 'Decision Making'],
  ['2026-08-11', 'Healthy Relationships'],
  ['2026-08-18', 'Self-Advocacy'],
  ['2026-08-25', 'Goal Setting'],
] as const;

const attendanceBySession = [
  ['present', 'present', 'late', 'present', 'absent'],
  ['present', 'absent', 'present', 'present', 'excused'],
  ['late', 'present', 'present', 'present', 'present'],
] as const;

async function main() {
  const result = await sql.begin(async rawTx => {
    const tx = rawTx as unknown as typeof sql;

    const [staffRole] = await tx<{ id: string }[]>`SELECT id FROM user_roles WHERE name = 'staff'`;
    const [youthRole] = await tx<{ id: string }[]>`SELECT id FROM user_roles WHERE name = 'youth'`;

    await tx`
      INSERT INTO users (id, role_id, first_name, last_name)
      VALUES (${fixtureStaffId}, ${staffRole.id}, 'Programming', 'Demo')
      ON CONFLICT (id) DO UPDATE SET
        role_id = EXCLUDED.role_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = NOW()
    `;

    const [softSkills] = await tx<{ id: string }[]>`
      INSERT INTO programs (name, description, min_age, max_age)
      VALUES (
        'Soft Skills',
        'Builds communication, emotional regulation, teamwork, and practical life skills.',
        12,
        15
      )
      ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        min_age = EXCLUDED.min_age,
        max_age = EXCLUDED.max_age
      RETURNING id
    `;

    await tx`
      INSERT INTO programs (name, description, min_age, max_age)
      VALUES (
        'Job Readiness',
        'Prepares older youth for resumes, interviews, workplace communication, and employment.',
        16,
        19
      )
      ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        min_age = EXCLUDED.min_age,
        max_age = EXCLUDED.max_age
    `;

    const [cycle] = await tx<{ id: string }[]>`
      INSERT INTO program_cycles (name, starts_on, ends_on, created_by, updated_by)
      VALUES ('Summer 2026', '2026-07-01', '2026-09-01', ${fixtureStaffId}, ${fixtureStaffId})
      ON CONFLICT (name) DO UPDATE SET
        starts_on = EXCLUDED.starts_on,
        ends_on = EXCLUDED.ends_on,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING id
    `;

    const [cohort] = await tx<{ id: string }[]>`
      INSERT INTO program_cohorts (program_id, cycle_id, created_by, updated_by)
      VALUES (${softSkills.id}, ${cycle.id}, ${fixtureStaffId}, ${fixtureStaffId})
      ON CONFLICT (program_id, cycle_id) DO UPDATE SET
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING id
    `;

    for (const [id, firstName, lastName] of youthFixtures) {
      await tx`
        INSERT INTO users (id, role_id, first_name, last_name)
        VALUES (${id}, ${youthRole.id}, ${firstName}, ${lastName})
        ON CONFLICT (id) DO UPDATE SET
          role_id = EXCLUDED.role_id,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          updated_at = NOW()
      `;
      await tx`
        INSERT INTO youth_profiles (user_id, created_by, updated_by)
        VALUES (${id}, ${fixtureStaffId}, ${fixtureStaffId})
        ON CONFLICT (user_id) DO UPDATE SET
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by
      `;
      await tx`
        INSERT INTO cohort_enrollments (
          cohort_id, youth_id, enrolled_on, created_by, updated_by
        )
        VALUES (
          ${cohort.id}, ${id}, '2026-07-01', ${fixtureStaffId}, ${fixtureStaffId}
        )
        ON CONFLICT (cohort_id, youth_id) DO UPDATE SET
          enrolled_on = EXCLUDED.enrolled_on,
          withdrawn_on = NULL,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by
      `;
    }

    const sessionIds: string[] = [];
    for (const [date, theme] of sessionFixtures) {
      const [session] = await tx<{ id: string }[]>`
        INSERT INTO cohort_sessions (
          cohort_id, theme, starts_at, ends_at, created_by, updated_by
        )
        VALUES (
          ${cohort.id},
          ${theme},
          (${date}::date + '17:00'::time) AT TIME ZONE 'America/Toronto',
          (${date}::date + '19:30'::time) AT TIME ZONE 'America/Toronto',
          ${fixtureStaffId},
          ${fixtureStaffId}
        )
        ON CONFLICT (cohort_id, theme, starts_at) DO UPDATE SET
          theme = EXCLUDED.theme,
          ends_at = EXCLUDED.ends_at,
          cancelled_at = NULL,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by
        RETURNING id
      `;
      sessionIds.push(session.id);
    }

    for (let sessionIndex = 0; sessionIndex < attendanceBySession.length; sessionIndex += 1) {
      for (let youthIndex = 0; youthIndex < youthFixtures.length; youthIndex += 1) {
        await tx`
          INSERT INTO attendance_records (
            session_id, youth_id, status, marked_by
          )
          VALUES (
            ${sessionIds[sessionIndex]},
            ${youthFixtures[youthIndex][0]},
            ${attendanceBySession[sessionIndex][youthIndex]},
            ${fixtureStaffId}
          )
          ON CONFLICT (session_id, youth_id) DO UPDATE SET
            status = EXCLUDED.status,
            marked_at = NOW(),
            marked_by = EXCLUDED.marked_by,
            updated_at = NOW()
        `;
      }
    }

    return {
      programId: softSkills.id,
      cohortId: cohort.id,
      youthCount: youthFixtures.length,
      sessionCount: sessionIds.length,
    };
  });

  console.log(
    `Programming demo ready: Soft Skills / Summer 2026 `
    + `(${result.youthCount} youth, ${result.sessionCount} Tuesday sessions)`,
  );
}

main()
  .catch(error => {
    console.error('ERROR: Failed to seed programming demo');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
