import crypto from 'crypto';
import { sql, asTransactionSql } from '../db/client';
import { audit } from './auditService';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import type { SetTimeEntryInput, TimeEntryQuery } from '../validation/timeEntrySchemas';

interface TimeEntryRow {
  id: string;
  staffId: string;
  programId: string | null;
  programName: string | null;
  cohortId: string | null;
  cohortName: string | null;
  task: SetTimeEntryInput['task'];
  workDate: string;
  hours: string;
  note: string;
}

function assertCanManageStaff(actor: AccessTokenPayload, staffId: string) {
  if (actor.role !== 'admin' && actor.userId !== staffId) {
    throw new ForbiddenError('Staff can only manage their own time entries');
  }
}

async function assertStaffResource(staffId: string) {
  const rows = await sql<{ id: string }[]>`
    SELECT u.id
    FROM users u
    INNER JOIN user_roles role ON role.id = u.role_id
    INNER JOIN user_credentials credentials ON credentials.user_id = u.id
    WHERE u.id = ${staffId}
      AND role.name IN ('admin', 'staff')
      AND credentials.status = 'active'
    LIMIT 1
  `;
  if (!rows.length) throw new NotFoundError('Staff member not found');
}

async function assertProgramResource(programId: string | null) {
  if (!programId) return;
  const rows = await sql<{ id: string }[]>`SELECT id FROM programs WHERE id = ${programId} LIMIT 1`;
  if (!rows.length) throw new NotFoundError('Program not found');
}

async function assertCohortProgram(cohortId: string | null, programId: string | null) {
  if (!cohortId) return;
  if (!programId) throw new BadRequestError('A program is required when selecting a cohort');
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM program_cohorts WHERE id = ${cohortId} AND program_id = ${programId} LIMIT 1
  `;
  if (!rows.length) throw new NotFoundError('Cohort not found for selected program');
}

export async function getTimeEntryCohorts(programId: string) {
  await assertProgramResource(programId);
  return sql<Array<{ id: string; name: string; state: 'active' | 'upcoming' | 'completed' }>>`
    SELECT
      id,
      name,
      CASE
        WHEN CURRENT_DATE < starts_on THEN 'upcoming'
        WHEN CURRENT_DATE > ends_on THEN 'completed'
        ELSE 'active'
      END AS state
    FROM program_cohorts
    WHERE program_id = ${programId}
    ORDER BY
      CASE
        WHEN CURRENT_DATE BETWEEN starts_on AND ends_on THEN 0
        WHEN CURRENT_DATE < starts_on THEN 1
        ELSE 2
      END,
      starts_on DESC,
      name,
      id
  `;
}

export async function getTimeEntries(actor: AccessTokenPayload, query: TimeEntryQuery) {
  const programs = await sql<Array<{ id: string; name: string }>>`
    SELECT id, name FROM programs ORDER BY name, id
  `;
  const resources = await sql<Array<{ id: string; name: string; role: string }>>`
    SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name, role.name AS role
    FROM users u
    INNER JOIN user_roles role ON role.id = u.role_id
    INNER JOIN user_credentials credentials ON credentials.user_id = u.id
    WHERE role.name IN ('admin', 'staff')
      AND credentials.status = 'active'
      AND ${actor.role === 'admin' ? sql`TRUE` : sql`u.id = ${actor.userId}`}
    ORDER BY u.first_name, u.last_name, u.id
  `;
  const rows = await sql<TimeEntryRow[]>`
    SELECT
      entry.id,
      entry.staff_id,
      entry.program_id,
      program.name AS program_name,
      entry.cohort_id,
      cohort.name AS cohort_name,
      entry.task,
      entry.work_date::text,
      entry.hours::text,
      entry.note
    FROM time_entries entry
    INNER JOIN users staff ON staff.id = entry.staff_id
    LEFT JOIN programs program ON program.id = entry.program_id
    LEFT JOIN program_cohorts cohort ON cohort.id = entry.cohort_id
    WHERE entry.work_date BETWEEN ${query.start}::date AND ${query.end}::date
      AND ${actor.role === 'admin' ? sql`TRUE` : sql`entry.staff_id = ${actor.userId}`}
    ORDER BY entry.work_date, staff.first_name, staff.last_name, entry.created_at, entry.id
  `;

  const taskLabels: Record<SetTimeEntryInput['task'], string> = {
    programming: 'Programming',
    planning_prep: 'Planning / Prep',
    meeting: 'Meeting',
    administration: 'Administration',
    promotion: 'Promotion',
    maintenance: 'Maintenance',
    other: 'Other',
  };
  const data: Record<string, Record<string, Array<{ id: string; programId: string | null; programName: string | null; cohortId: string | null; cohortName: string | null; task: string; label: string; hours: number; note: string }>>> = {};
  rows.forEach(row => {
    data[row.staffId] ??= {};
    data[row.staffId][row.workDate] ??= [];
    data[row.staffId][row.workDate].push({
      id: row.id,
      programId: row.programId,
      programName: row.programName,
      cohortId: row.cohortId,
      cohortName: row.cohortName,
      task: row.task,
      label: taskLabels[row.task],
      hours: Number(row.hours),
      note: row.note,
    });
  });

  return { resources, programs, data };
}

export async function createTimeEntry(input: SetTimeEntryInput, actor: AccessTokenPayload) {
  assertCanManageStaff(actor, input.staffId);
  await assertStaffResource(input.staffId);
  await assertProgramResource(input.programId);
  await assertCohortProgram(input.cohortId, input.programId);
  const transactionId = crypto.randomUUID();
  let created!: TimeEntryRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const rows = await trx<TimeEntryRow[]>`
      INSERT INTO time_entries (staff_id, program_id, cohort_id, task, work_date, hours, note, created_by, updated_by)
      VALUES (${input.staffId}, ${input.programId}, ${input.cohortId}, ${input.task}, ${input.workDate}, ${input.hours}, ${input.note}, ${actor.userId}, ${actor.userId})
      RETURNING id, staff_id, program_id, (SELECT name FROM programs WHERE id = time_entries.program_id) AS program_name,
        cohort_id, (SELECT name FROM program_cohorts WHERE id = time_entries.cohort_id) AS cohort_name,
        task, work_date::text, hours::text, note
    `;
    created = rows[0];
    await audit(trx, actor.userId, transactionId, 'time_entries', created.id, 'INSERT', null, { ...created });
  });
  return { ...created, hours: Number(created.hours) };
}

async function getOwnedEntry(id: string, actor: AccessTokenPayload) {
  const rows = await sql<TimeEntryRow[]>`SELECT * FROM time_entries WHERE id = ${id} LIMIT 1`;
  if (!rows.length) throw new NotFoundError('Time entry not found');
  assertCanManageStaff(actor, rows[0].staffId);
  return rows[0];
}

export async function updateTimeEntry(id: string, input: SetTimeEntryInput, actor: AccessTokenPayload) {
  const existing = await getOwnedEntry(id, actor);
  assertCanManageStaff(actor, input.staffId);
  await assertStaffResource(input.staffId);
  await assertProgramResource(input.programId);
  await assertCohortProgram(input.cohortId, input.programId);
  const transactionId = crypto.randomUUID();
  let updated!: TimeEntryRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const rows = await trx<TimeEntryRow[]>`
      UPDATE time_entries
      SET staff_id = ${input.staffId}, program_id = ${input.programId}, cohort_id = ${input.cohortId}, task = ${input.task}, work_date = ${input.workDate},
          hours = ${input.hours}, note = ${input.note}, updated_by = ${actor.userId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, staff_id, program_id, (SELECT name FROM programs WHERE id = time_entries.program_id) AS program_name,
        cohort_id, (SELECT name FROM program_cohorts WHERE id = time_entries.cohort_id) AS cohort_name,
        task, work_date::text, hours::text, note
    `;
    updated = rows[0];
    await audit(trx, actor.userId, transactionId, 'time_entries', id, 'UPDATE', { ...existing }, { ...updated });
  });
  return { ...updated, hours: Number(updated.hours) };
}

export async function deleteTimeEntry(id: string, actor: AccessTokenPayload) {
  const existing = await getOwnedEntry(id, actor);
  const transactionId = crypto.randomUUID();
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    await trx`DELETE FROM time_entries WHERE id = ${id}`;
    await audit(trx, actor.userId, transactionId, 'time_entries', id, 'DELETE', { ...existing }, null);
  });
}
