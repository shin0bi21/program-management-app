#!/usr/bin/env node

import postgres from 'postgres';
import { requireEnv } from '../../src/utils/env';

const databaseUrl = requireEnv('DATABASE_URL');
const fixtureStaffId = '20000000-0000-4000-8000-000000000001';

const sql = postgres(databaseUrl);

async function main() {
  const [fixture] = await sql<Array<{ staffId: string; programId: string; cohortId: string | null }>>`
    SELECT
      staff.id AS "staffId",
      program.id AS "programId",
      cohort.id AS "cohortId"
    FROM users staff
    CROSS JOIN LATERAL (
      SELECT id FROM programs WHERE name = 'Soft Skills' LIMIT 1
    ) program
    LEFT JOIN LATERAL (
      SELECT id FROM program_cohorts
      WHERE program_id = program.id
      ORDER BY starts_on DESC
      LIMIT 1
    ) cohort ON TRUE
    WHERE staff.id = ${fixtureStaffId}
    LIMIT 1
  `;
  if (!fixture) throw new Error('Programming demo staff or Soft Skills demo program is missing');

  await sql`
    INSERT INTO time_entries (
      id, staff_id, program_id, cohort_id, task, work_date, hours, note, created_by, updated_by
    )
    VALUES
      ('30000000-0000-4000-8000-000000000001', ${fixture.staffId}, ${fixture.programId}, ${fixture.cohortId}, 'programming', CURRENT_DATE, 2.5, 'Delivered the weekly Soft Skills workshop.', ${fixture.staffId}, ${fixture.staffId}),
      ('30000000-0000-4000-8000-000000000002', ${fixture.staffId}, ${fixture.programId}, ${fixture.cohortId}, 'planning_prep', CURRENT_DATE, 1.25, 'Prepared activities and materials for the next cohort session.', ${fixture.staffId}, ${fixture.staffId}),
      ('30000000-0000-4000-8000-000000000003', ${fixture.staffId}, NULL, NULL, 'meeting', CURRENT_DATE, 1, 'Weekly staff coordination meeting.', ${fixture.staffId}, ${fixture.staffId}),
      ('30000000-0000-4000-8000-000000000004', ${fixture.staffId}, NULL, NULL, 'administration', CURRENT_DATE - 1, 1.5, 'Completed general program documentation and follow-up.', ${fixture.staffId}, ${fixture.staffId}),
      ('30000000-0000-4000-8000-000000000005', ${fixture.staffId}, ${fixture.programId}, NULL, 'promotion', CURRENT_DATE + 1, 1, 'Prepared promotional material for the program.', ${fixture.staffId}, ${fixture.staffId})
    ON CONFLICT (id) DO UPDATE SET
      staff_id = EXCLUDED.staff_id,
      program_id = EXCLUDED.program_id,
      cohort_id = EXCLUDED.cohort_id,
      task = EXCLUDED.task,
      work_date = EXCLUDED.work_date,
      hours = EXCLUDED.hours,
      note = EXCLUDED.note,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `;

  console.log('Timesheet demo ready: 5 entries across 3 days');
}

main()
  .catch(error => {
    console.error('ERROR: Failed to seed Timesheet demo');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
