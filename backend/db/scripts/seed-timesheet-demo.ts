#!/usr/bin/env node

import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { requireEnv } from '../../src/utils/env';

const databaseUrl = requireEnv('DATABASE_URL');
const primaryStaffId = '20000000-0000-4000-8000-000000000001';
const secondStaffId = '20000000-0000-4000-8000-000000000002';
const primaryDeliveryTaskId = '40000000-0000-4000-8000-000000000001';
const secondDeliveryTaskId = '40000000-0000-4000-8000-000000000002';
const primaryOutreachTaskId = '40000000-0000-4000-8000-000000000003';
const secondPlanningTaskId = '40000000-0000-4000-8000-000000000004';

const sql = postgres(databaseUrl);

const entries = [
  ['30000000-0000-4000-8000-000000000001', primaryStaffId, 'Soft Skills', 'program_delivery', '2026-07-03', 3, 'Delivered the opening Soft Skills workshop.'],
  ['30000000-0000-4000-8000-000000000002', primaryStaffId, 'Soft Skills', 'planning_prep', '2026-07-08', 1.5, 'Prepared activities and materials for the next session.'],
  ['30000000-0000-4000-8000-000000000003', primaryStaffId, null, 'meeting', '2026-07-10', 1, 'Weekly staff coordination meeting.'],
  ['30000000-0000-4000-8000-000000000004', primaryStaffId, 'Soft Skills', 'program_delivery', '2026-07-17', 3.5, 'Facilitated communication and conflict-resolution activities.'],
  ['30000000-0000-4000-8000-000000000005', primaryStaffId, null, 'administration', '2026-07-22', 1.25, 'Updated attendance records and participant documentation.'],
  ['30000000-0000-4000-8000-000000000006', primaryStaffId, 'Job Readiness', 'outreach', '2026-07-28', 2, 'Connected with community partners about youth placements.'],
  ['30000000-0000-4000-8000-000000000007', primaryStaffId, 'Soft Skills', 'planning_prep', '2026-08-03', 1.75, 'Prepared the healthy-relationships workshop.'],
  ['30000000-0000-4000-8000-000000000008', primaryStaffId, 'Soft Skills', 'program_delivery', '2026-08-04', 3, 'Delivered the healthy-relationships workshop.'],
  ['30000000-0000-4000-8000-000000000009', primaryStaffId, null, 'maintenance', '2026-08-07', 1, 'Organized shared program supplies and equipment.'],
  ['30000000-0000-4000-8000-000000000010', primaryStaffId, null, 'meeting', '2026-08-10', 1.5, 'Reviewed cycle progress with the staff team.'],
  ['30000000-0000-4000-8000-000000000011', secondStaffId, 'Job Readiness', 'planning_prep', '2026-07-02', 2, 'Prepared resume and interview practice materials.'],
  ['30000000-0000-4000-8000-000000000012', secondStaffId, 'Job Readiness', 'program_delivery', '2026-07-07', 4, 'Facilitated resume-building and workplace communication.'],
  ['30000000-0000-4000-8000-000000000013', secondStaffId, null, 'administration', '2026-07-15', 1.5, 'Completed participant follow-up and program documentation.'],
  ['30000000-0000-4000-8000-000000000014', secondStaffId, 'Job Readiness', 'program_delivery', '2026-07-21', 3.5, 'Led mock interviews and provided individual feedback.'],
  ['30000000-0000-4000-8000-000000000015', secondStaffId, 'Job Readiness', 'outreach', '2026-07-27', 2.25, 'Contacted employers about workplace tours and placements.'],
  ['30000000-0000-4000-8000-000000000016', secondStaffId, null, 'meeting', '2026-08-03', 1, 'Attended the weekly staff coordination meeting.'],
  ['30000000-0000-4000-8000-000000000017', secondStaffId, 'Job Readiness', 'planning_prep', '2026-08-06', 2, 'Prepared mock-interview stations and facilitator notes.'],
  ['30000000-0000-4000-8000-000000000018', secondStaffId, 'Job Readiness', 'program_delivery', '2026-08-10', 4, 'Facilitated mock interviews with the Job Readiness cohort.'],
] as const;

async function main() {
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  await sql.begin(async rawTx => {
    const tx = rawTx as unknown as typeof sql;
    const [staffRole] = await tx<{ id: string }[]>`SELECT id FROM user_roles WHERE name = 'staff'`;
    const programs = await tx<Array<{ id: string; name: string }>>`
      SELECT id, name FROM programs WHERE name IN ('Soft Skills', 'Job Readiness')
    `;
    const [cycle] = await tx<{ id: string }[]>`
      SELECT id FROM program_cycles WHERE name = 'Summer 2026' LIMIT 1
    `;
    if (!staffRole || programs.length !== 2 || !cycle) {
      throw new Error('Programming demo role, programs, or Summer 2026 cycle is missing');
    }
    const programIds = new Map(programs.map(program => [program.name, program.id]));

    await tx`
      INSERT INTO users (id, role_id, first_name, last_name)
      VALUES
        (${primaryStaffId}, ${staffRole.id}, 'Jordan', 'Lee'),
        (${secondStaffId}, ${staffRole.id}, 'Taylor', 'Brooks')
      ON CONFLICT (id) DO UPDATE SET
        role_id = EXCLUDED.role_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = NOW()
    `;

    await tx`
      INSERT INTO user_credentials (user_id, email, password_hash, email_verified, status)
      VALUES
        (${primaryStaffId}, 'jordan.lee@demo.local', ${passwordHash}, true, 'active'),
        (${secondStaffId}, 'taylor.brooks@demo.local', ${passwordHash}, true, 'active')
      ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        email_verified = true,
        status = 'active',
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    `;

    for (const programId of programIds.values()) {
      await tx`
        INSERT INTO program_cohorts (program_id, cycle_id, created_by, updated_by)
        VALUES (${programId}, ${cycle.id}, ${primaryStaffId}, ${primaryStaffId})
        ON CONFLICT (program_id, cycle_id) DO NOTHING
      `;
    }

    for (const staffId of [primaryStaffId, secondStaffId]) {
      for (const programId of programIds.values()) {
        await tx`
          INSERT INTO staff_program_assignments (staff_id, program_id)
          VALUES (${staffId}, ${programId})
          ON CONFLICT (staff_id, program_id) DO NOTHING
        `;
      }
    }

    const softSkillsId = programIds.get('Soft Skills')!;
    const jobReadinessId = programIds.get('Job Readiness')!;
    await tx`
      INSERT INTO tasks (
        id, title, details, category, staff_id, program_id, cycle_id, status,
        start_date, due_date, created_by, updated_by
      ) VALUES
        (${primaryDeliveryTaskId}, 'Deliver healthy relationships workshop', 'Facilitate the scheduled Soft Skills workshop.', 'program_delivery', ${primaryStaffId}, ${softSkillsId}, ${cycle.id}, 'in_progress', '2026-08-01', '2026-08-14', ${primaryStaffId}, ${primaryStaffId}),
        (${secondDeliveryTaskId}, 'Run mock interview session', 'Lead the Job Readiness mock interview rotation.', 'program_delivery', ${secondStaffId}, ${jobReadinessId}, ${cycle.id}, 'in_progress', '2026-08-06', '2026-08-14', ${secondStaffId}, ${secondStaffId}),
        (${primaryOutreachTaskId}, 'Confirm community partner visit', 'Coordinate the upcoming partner visit and participant list.', 'outreach', ${primaryStaffId}, NULL, ${cycle.id}, 'todo', '2026-08-11', '2026-08-18', ${primaryStaffId}, ${primaryStaffId}),
        (${secondPlanningTaskId}, 'Prepare workplace tour materials', 'Prepare participant handouts and facilitator notes.', 'planning_prep', ${secondStaffId}, ${jobReadinessId}, ${cycle.id}, 'todo', '2026-08-12', '2026-08-20', ${secondStaffId}, ${secondStaffId})
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        details = EXCLUDED.details,
        category = EXCLUDED.category,
        staff_id = EXCLUDED.staff_id,
        program_id = EXCLUDED.program_id,
        cycle_id = EXCLUDED.cycle_id,
        status = EXCLUDED.status,
        start_date = EXCLUDED.start_date,
        due_date = EXCLUDED.due_date,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `;

    for (const [id, staffId, programName, category, workDate, hours, note] of entries) {
      let programId: string | null = null;
      if (programName) {
        const matchingProgramId = programIds.get(programName);
        if (!matchingProgramId) throw new Error(`Program fixture not found: ${programName}`);
        programId = matchingProgramId;
      }
      await tx`
        INSERT INTO time_entries (
          id, staff_id, program_id, cycle_id, category, work_date, hours, note, created_by, updated_by
        )
        VALUES (
          ${id}, ${staffId}, ${programId}, ${cycle.id},
          ${category}, ${workDate}, ${hours}, ${note}, ${staffId}, ${staffId}
        )
        ON CONFLICT (id) DO UPDATE SET
          staff_id = EXCLUDED.staff_id,
          program_id = EXCLUDED.program_id,
          cycle_id = EXCLUDED.cycle_id,
          category = EXCLUDED.category,
          work_date = EXCLUDED.work_date,
          hours = EXCLUDED.hours,
          note = EXCLUDED.note,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
      `;
    }

    await tx`
      UPDATE time_entries
      SET task_id = CASE id
        WHEN '30000000-0000-4000-8000-000000000008'::uuid THEN ${primaryDeliveryTaskId}::uuid
        WHEN '30000000-0000-4000-8000-000000000018'::uuid THEN ${secondDeliveryTaskId}::uuid
        ELSE task_id
      END,
      updated_at = NOW()
      WHERE id IN (
        '30000000-0000-4000-8000-000000000008'::uuid,
        '30000000-0000-4000-8000-000000000018'::uuid
      )
    `;
  });

  console.log(`Staff demo ready: ${entries.length} time entries and 4 tasks across 2 active staff accounts`);
}

main()
  .catch(error => {
    console.error('ERROR: Failed to seed Timesheet demo');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
