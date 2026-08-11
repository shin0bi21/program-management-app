import crypto from 'crypto';
import { sql, asTransactionSql } from '../db/client';
import { audit } from './auditService';
import { ConflictError, InternalServerError, NotFoundError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import type {
  SetTimeEntryInput,
  TimeEntryCategory,
  TimeEntryOverviewQuery,
  TimeEntryQuery,
  TimeEntrySessionQuery,
  UpdateTimeEntryPlacementInput,
} from '../validation/timeEntrySchemas';
import { assertCanWriteTimeFor, timeEntryReadScopePredicate, timeEntryResourceReadScopePredicate, timeEntryWriteScopePredicate } from '../policies/timeEntryPolicy';
import { getBiweeklyPayPeriod } from './timeEntryPeriods';

interface TimeEntryRow {
  id: string;
  staffId: string;
  programId: string | null;
  programName: string | null;
  cycleId: string;
  cycleName: string;
  cycleStartsOn: string;
  cycleEndsOn: string;
  category: TimeEntryCategory;
  taskId: string | null;
  taskTitle: string | null;
  sessionId: string | null;
  sessionLabel: string | null;
  workDate: string;
  hours: string;
  note: string;
}

const categoryLabels: Record<TimeEntryCategory, string> = {
  program_delivery: 'Program Delivery',
  planning_prep: 'Planning / Prep',
  meeting: 'Meeting',
  administration: 'Administration',
  outreach: 'Outreach',
  maintenance: 'Maintenance',
  other: 'Other',
};

async function resolveTimeEntryScope(input: SetTimeEntryInput, db: typeof sql) {
  if (input.source === 'other') return {
    programId: input.programId, cycleId: input.cycleId, category: input.category,
    taskId: null, taskStatus: null, sessionId: null, workDate: input.workDate,
  };
  if (input.source === 'session') {
    const rows = await db<Array<{ programId: string; cycleId: string; workDate: string }>>`
      SELECT cohort.program_id, cohort.cycle_id,
        (session.starts_at AT TIME ZONE 'America/Toronto')::date::text AS work_date
      FROM cohort_sessions session
      INNER JOIN program_cohorts cohort ON cohort.id = session.cohort_id
      INNER JOIN users target_staff ON target_staff.id = ${input.staffId}
      WHERE session.id = ${input.sessionId}
        AND session.cancelled_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM user_program_assignments assignment
          WHERE assignment.program_id = cohort.program_id
            AND assignment.user_id = target_staff.id
        )
      LIMIT 1
      FOR UPDATE OF session
    `;
    if (!rows.length) throw new NotFoundError('Assigned session not found');
    return {
      ...rows[0], category: 'program_delivery' as const,
      taskId: null, taskStatus: null, sessionId: input.sessionId,
    };
  }
  const rows = await db<Array<{ category: string; programId: string | null; cycleId: string; status: 'todo' | 'in_progress' | 'completed'; startDate: string; dueDate: string }>>`
    SELECT task.category, task.program_id, task.cycle_id, task.status,
      task.start_date::text, task.due_date::text
    FROM tasks task
    WHERE task.id = ${input.taskId}
      AND task.staff_id = ${input.staffId}
      AND task.status <> 'cancelled'
    LIMIT 1
    FOR UPDATE OF task
  `;
  if (!rows.length) throw new NotFoundError('Assigned task not found');
  const task = rows[0];
  return {
    programId: task.programId, cycleId: task.cycleId, category: task.category as TimeEntryCategory,
    taskId: input.taskId, taskStatus: task.status, sessionId: null, workDate: input.workDate,
  };
}

async function markTaskInProgress(
  taskId: string | null,
  status: 'todo' | 'in_progress' | 'completed' | null,
  staffId: string,
  trx: typeof sql,
  actor: AccessTokenPayload,
  transactionId: string,
) {
  if (!taskId || status !== 'todo') return;
  await trx`
    UPDATE tasks
    SET status = 'in_progress', completed_at = NULL, updated_by = ${actor.userId}, updated_at = NOW()
    WHERE id = ${taskId}
  `;
  await audit(trx, actor.userId, transactionId, 'tasks', taskId, 'UPDATE',
    { status: 'todo', staffId }, { status: 'in_progress', staffId });
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

async function assertProgramResource(programId: string | null, db: typeof sql = sql) {
  if (!programId) return;
  const rows = await db<{ id: string }[]>`SELECT id FROM programs WHERE id = ${programId} LIMIT 1`;
  if (!rows.length) throw new NotFoundError('Program not found');
}

function getTimeEntryResources(actor: AccessTokenPayload) {
  return sql<Array<{ id: string; firstName: string; lastName: string; name: string; role: string; writable: boolean }>>`
    SELECT u.id, u.first_name, u.last_name, CONCAT(u.first_name, ' ', u.last_name) AS name, role.name AS role,
      (${timeEntryWriteScopePredicate(actor, sql`u.id`)}) AS writable
    FROM users u
    INNER JOIN user_roles role ON role.id = u.role_id
    INNER JOIN user_credentials credentials ON credentials.user_id = u.id
    WHERE role.name IN ('admin', 'staff')
      AND credentials.status = 'active'
      AND ${timeEntryResourceReadScopePredicate(actor, sql`u.id`)}
    ORDER BY u.first_name, u.last_name, u.id
  `;
}

async function assertCycleResource(cycleId: string, programId: string | null, db: typeof sql = sql) {
  const rows = await db<{ id: string }[]>`
    SELECT cycle.id
    FROM program_cycles cycle
    WHERE cycle.id = ${cycleId}
      AND ${programId ? sql`EXISTS (
        SELECT 1 FROM program_cohorts cohort
        WHERE cohort.program_id = ${programId} AND cohort.cycle_id = cycle.id
      )` : sql`TRUE`}
    LIMIT 1
  `;
  if (!rows.length) throw new NotFoundError(programId ? 'Cycle not found for selected program' : 'Cycle not found');
}

export async function getTimeEntryCohorts(programId: string) {
  await assertProgramResource(programId);
  return sql<Array<{ id: string; cycleId: string; name: string; state: 'active' | 'upcoming' | 'completed' }>>`
    SELECT
      cohort.id,
      cycle.id AS cycle_id,
      cycle.name,
      cycle.starts_on::text AS starts_on,
      cycle.ends_on::text AS ends_on,
      CASE
        WHEN CURRENT_DATE < cycle.starts_on THEN 'upcoming'
        WHEN CURRENT_DATE > cycle.ends_on THEN 'completed'
        ELSE 'active'
      END AS state
    FROM program_cohorts cohort
    INNER JOIN program_cycles cycle ON cycle.id = cohort.cycle_id
    WHERE cohort.program_id = ${programId}
    ORDER BY
      CASE
        WHEN CURRENT_DATE BETWEEN cycle.starts_on AND cycle.ends_on THEN 0
        WHEN CURRENT_DATE < cycle.starts_on THEN 1
        ELSE 2
      END,
      cycle.starts_on DESC,
      cycle.name,
      cohort.id
  `;
}

export async function getTimeEntrySessions(actor: AccessTokenPayload, query: TimeEntrySessionQuery) {
  assertCanWriteTimeFor(actor, query.staffId);
  await assertStaffResource(query.staffId);
  return sql<Array<{
    id: string; label: string; programId: string; programName: string;
    cycleId: string; cycleName: string; workDate: string; startsAt: string;
  }>>`
    SELECT session.id,
      session.theme AS label,
      program.id AS program_id, program.name AS program_name,
      cycle.id AS cycle_id, cycle.name AS cycle_name,
      (session.starts_at AT TIME ZONE 'America/Toronto')::date::text AS work_date,
      session.starts_at::text AS starts_at
    FROM cohort_sessions session
    INNER JOIN program_cohorts cohort ON cohort.id = session.cohort_id
    INNER JOIN programs program ON program.id = cohort.program_id
    INNER JOIN program_cycles cycle ON cycle.id = cohort.cycle_id
    INNER JOIN users target_staff ON target_staff.id = ${query.staffId}
    WHERE session.cancelled_at IS NULL
      AND (session.starts_at AT TIME ZONE 'America/Toronto')::date = ${query.workDate}::date
      AND EXISTS (
        SELECT 1
        FROM user_program_assignments assignment
        WHERE assignment.program_id = program.id
          AND assignment.user_id = target_staff.id
      )
    ORDER BY session.starts_at, session.id
  `;
}

export async function getTimeEntries(actor: AccessTokenPayload, query: TimeEntryQuery) {
  const programs = await sql<Array<{ id: string; name: string }>>`
    SELECT id, name FROM programs ORDER BY name, id
  `;
  const resources = await getTimeEntryResources(actor);
  const rows = await sql<TimeEntryRow[]>`
    SELECT
      entry.id,
      entry.staff_id,
      entry.program_id,
      program.name AS program_name,
      cycle.id AS cycle_id,
      cycle.name AS cycle_name,
      cycle.starts_on::text AS cycle_starts_on,
      cycle.ends_on::text AS cycle_ends_on,
      entry.category,
      entry.task_id,
      task.title AS task_title,
      entry.session_id,
      session.theme AS session_label,
      entry.work_date::text,
      entry.hours::text,
      entry.note
    FROM time_entries entry
    INNER JOIN users staff ON staff.id = entry.staff_id
    LEFT JOIN programs program ON program.id = entry.program_id
    INNER JOIN program_cycles cycle ON cycle.id = entry.cycle_id
    LEFT JOIN tasks task ON task.id = entry.task_id
    LEFT JOIN cohort_sessions session ON session.id = entry.session_id
    WHERE ${query.start && query.end
      ? sql`entry.work_date BETWEEN ${query.start}::date AND ${query.end}::date`
      : sql`TRUE`}
      AND ${query.cycleId ? sql`entry.cycle_id = ${query.cycleId}` : sql`TRUE`}
      AND ${timeEntryReadScopePredicate(actor, sql`entry.staff_id`)}
    ORDER BY entry.work_date, staff.first_name, staff.last_name, entry.created_at, entry.id
  `;

  const data: Record<string, Record<string, Array<{ id: string; programId: string | null; programName: string | null; cycleId: string; cycleName: string; cycleStartsOn: string; cycleEndsOn: string; category: string; categoryLabel: string; taskId: string | null; taskTitle: string | null; sessionId: string | null; sessionLabel: string | null; hours: number; note: string }>>> = {};
  rows.forEach(row => {
    data[row.staffId] ??= {};
    data[row.staffId][row.workDate] ??= [];
    data[row.staffId][row.workDate].push({
      id: row.id,
      programId: row.programId,
      programName: row.programName,
      cycleId: row.cycleId,
      cycleName: row.cycleName,
      cycleStartsOn: row.cycleStartsOn,
      cycleEndsOn: row.cycleEndsOn,
      category: row.category,
      categoryLabel: categoryLabels[row.category],
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      sessionId: row.sessionId,
      sessionLabel: row.sessionLabel,
      hours: Number(row.hours),
      note: row.note,
    });
  });

  return { resources, programs, data };
}

export async function getTimeEntryOverview(actor: AccessTokenPayload, query: TimeEntryOverviewQuery) {
  const readableStaff = await getTimeEntryResources(actor);
  if (!readableStaff.some(resource => resource.id === query.staffId)) {
    throw new NotFoundError('Timesheet overview not found');
  }
  const [payPeriodCycle] = await sql<Array<{ startsOn: string; currentDate: string }>>`
    SELECT starts_on::text AS starts_on,
      (NOW() AT TIME ZONE 'America/Toronto')::date::text AS current_date
    FROM program_cycles
    WHERE starts_on <= (NOW() AT TIME ZONE 'America/Toronto')::date
    ORDER BY starts_on DESC, id
    LIMIT 1
  `;
  if (!payPeriodCycle) {
    throw new InternalServerError('Expected a program cycle to have started before the current pay period.');
  }
  const payPeriod = getBiweeklyPayPeriod(payPeriodCycle.startsOn, payPeriodCycle.currentDate);

  const rows = await sql<Array<{
    periodStart: string;
    periodEnd: string;
    periodCount: number;
    category: TimeEntryCategory | null;
    periodHours: string;
    cycleHours: string;
  }>>`
    WITH current_period AS (
      SELECT
        ${payPeriod.periodStart}::date AS period_start,
        ${payPeriod.periodEnd}::date AS period_end
    ), selected_cycle AS (
      SELECT id, starts_on, ends_on,
        GREATEST(
          starts_on,
          LEAST(ends_on, (NOW() AT TIME ZONE 'America/Toronto')::date)
        ) AS effective_date
      FROM program_cycles
      WHERE id = ${query.cycleId}
    ), selected_cycle_summary AS (
      SELECT id,
        ((effective_date - starts_on) / 14) + 1 AS period_count
      FROM selected_cycle
    ), categories AS (
      SELECT DISTINCT entry.category
      FROM time_entries entry, current_period period
      WHERE entry.staff_id = ${query.staffId}
        AND (
          entry.work_date BETWEEN period.period_start AND period.period_end
          OR entry.cycle_id = (SELECT id FROM selected_cycle)
        )
    )
    SELECT
      period.period_start::text AS period_start,
      period.period_end::text AS period_end,
      selected.period_count,
      category.category,
      COALESCE((
        SELECT SUM(entry.hours)
        FROM time_entries entry
        WHERE entry.staff_id = ${query.staffId}
          AND entry.category = category.category
          AND entry.work_date BETWEEN period.period_start AND period.period_end
      ), 0)::text AS period_hours,
      COALESCE((
        SELECT SUM(entry.hours)
        FROM time_entries entry
        WHERE entry.staff_id = ${query.staffId}
          AND entry.cycle_id = selected.id
          AND entry.category = category.category
      ), 0)::text AS cycle_hours
    FROM current_period period
    CROSS JOIN selected_cycle_summary selected
    LEFT JOIN categories category ON TRUE
    ORDER BY category.category
  `;
  if (!rows.length) throw new NotFoundError('Timesheet overview not found');

  const payPeriodBreakdown = rows.flatMap(row => row.category && Number(row.periodHours) > 0
    ? [{ label: categoryLabels[row.category], hours: Number(row.periodHours) }]
    : []).sort((left, right) => right.hours - left.hours || left.label.localeCompare(right.label));
  const periodCount = Number(rows[0].periodCount);
  const biweeklyBreakdown = rows.flatMap(row => row.category && Number(row.cycleHours) > 0
    ? [{ label: categoryLabels[row.category], hours: Number(row.cycleHours) / periodCount }]
    : []).sort((left, right) => right.hours - left.hours || left.label.localeCompare(right.label));
  return {
    payPeriod: {
      periodStart: rows[0].periodStart,
      periodEnd: rows[0].periodEnd,
      totalHours: payPeriodBreakdown.reduce((total, item) => total + item.hours, 0),
      breakdown: payPeriodBreakdown,
    },
    biweeklyAverage: {
      periodCount,
      averageHours: biweeklyBreakdown.reduce((total, item) => total + item.hours, 0),
      breakdown: biweeklyBreakdown,
    },
  };
}

export async function createTimeEntry(input: SetTimeEntryInput, actor: AccessTokenPayload) {
  assertCanWriteTimeFor(actor, input.staffId);
  await assertStaffResource(input.staffId);
  const transactionId = crypto.randomUUID();
  let created!: TimeEntryRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const scope = await resolveTimeEntryScope(input, trx);
    await assertProgramResource(scope.programId, trx);
    await assertCycleResource(scope.cycleId, scope.programId, trx);
    const rows = await trx<TimeEntryRow[]>`
      INSERT INTO time_entries (staff_id, program_id, cycle_id, category, task_id, session_id, work_date, hours, note, created_by, updated_by)
      VALUES (${input.staffId}, ${scope.programId}, ${scope.cycleId}, ${scope.category}, ${scope.taskId}, ${scope.sessionId}, ${scope.workDate}, ${input.hours}, ${input.note}, ${actor.userId}, ${actor.userId})
      RETURNING id, staff_id, program_id, (SELECT name FROM programs WHERE id = time_entries.program_id) AS program_name,
        cycle_id,
        (SELECT name FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_name,
        (SELECT starts_on::text FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_starts_on,
        (SELECT ends_on::text FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_ends_on,
        category, task_id, (SELECT title FROM tasks WHERE id = time_entries.task_id) AS task_title,
        session_id, (SELECT session.theme FROM cohort_sessions session WHERE session.id = time_entries.session_id) AS session_label,
        work_date::text, hours::text, note
    `;
    created = rows[0];
    await markTaskInProgress(scope.taskId, scope.taskStatus, input.staffId, trx, actor, transactionId);
    await audit(trx, actor.userId, transactionId, 'time_entries', created.id, 'INSERT', null, { ...created });
  });
  return { ...created, hours: Number(created.hours) };
}

async function getOwnedEntry(trx: typeof sql, id: string, actor: AccessTokenPayload) {
  const rows = await trx<TimeEntryRow[]>`
    SELECT entry.id, entry.staff_id, entry.program_id, program.name AS program_name,
      entry.cycle_id, cycle.name AS cycle_name,
      cycle.starts_on::text AS cycle_starts_on, cycle.ends_on::text AS cycle_ends_on,
      entry.category, entry.task_id, task.title AS task_title,
      entry.session_id, session.theme AS session_label,
      entry.work_date::text, entry.hours::text, entry.note
    FROM time_entries entry
    LEFT JOIN programs program ON program.id = entry.program_id
    INNER JOIN program_cycles cycle ON cycle.id = entry.cycle_id
    LEFT JOIN tasks task ON task.id = entry.task_id
    LEFT JOIN cohort_sessions session ON session.id = entry.session_id
    WHERE entry.id = ${id}
    LIMIT 1
    FOR UPDATE OF entry
  `;
  if (!rows.length) throw new NotFoundError('Time entry not found');
  assertCanWriteTimeFor(actor, rows[0].staffId);
  return rows[0];
}

export async function updateTimeEntry(id: string, input: SetTimeEntryInput, actor: AccessTokenPayload) {
  assertCanWriteTimeFor(actor, input.staffId);
  await assertStaffResource(input.staffId);
  const transactionId = crypto.randomUUID();
  let updated!: TimeEntryRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const scope = await resolveTimeEntryScope(input, trx);
    await assertProgramResource(scope.programId, trx);
    await assertCycleResource(scope.cycleId, scope.programId, trx);
    const existing = await getOwnedEntry(trx, id, actor);
    const rows = await trx<TimeEntryRow[]>`
      UPDATE time_entries
      SET staff_id = ${input.staffId}, program_id = ${scope.programId}, cycle_id = ${scope.cycleId}, category = ${scope.category}, task_id = ${scope.taskId}, session_id = ${scope.sessionId}, work_date = ${scope.workDate},
          hours = ${input.hours}, note = ${input.note}, updated_by = ${actor.userId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, staff_id, program_id, (SELECT name FROM programs WHERE id = time_entries.program_id) AS program_name,
        cycle_id,
        (SELECT name FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_name,
        (SELECT starts_on::text FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_starts_on,
        (SELECT ends_on::text FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_ends_on,
        category, task_id, (SELECT title FROM tasks WHERE id = time_entries.task_id) AS task_title,
        session_id, (SELECT session.theme FROM cohort_sessions session WHERE session.id = time_entries.session_id) AS session_label,
        work_date::text, hours::text, note
    `;
    updated = rows[0];
    await markTaskInProgress(scope.taskId, scope.taskStatus, input.staffId, trx, actor, transactionId);
    await audit(trx, actor.userId, transactionId, 'time_entries', id, 'UPDATE', { ...existing }, { ...updated });
  });
  return { ...updated, hours: Number(updated.hours) };
}

export async function updateTimeEntryPlacement(
  id: string,
  input: UpdateTimeEntryPlacementInput,
  actor: AccessTokenPayload,
) {
  const transactionId = crypto.randomUUID();
  let updated!: TimeEntryRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const existing = await getOwnedEntry(trx, id, actor);
    if (existing.sessionId && input.workDate !== existing.workDate) {
      throw new ConflictError('Session time must stay on the session date');
    }
    const rows = await trx<TimeEntryRow[]>`
      UPDATE time_entries
      SET work_date = ${input.workDate}, updated_by = ${actor.userId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, staff_id, program_id, (SELECT name FROM programs WHERE id = time_entries.program_id) AS program_name,
        cycle_id,
        (SELECT name FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_name,
        (SELECT starts_on::text FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_starts_on,
        (SELECT ends_on::text FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_ends_on,
        category, task_id, (SELECT title FROM tasks WHERE id = time_entries.task_id) AS task_title,
        session_id, (SELECT session.theme FROM cohort_sessions session WHERE session.id = time_entries.session_id) AS session_label,
        work_date::text, hours::text, note
    `;
    updated = rows[0];
    await audit(trx, actor.userId, transactionId, 'time_entries', id, 'UPDATE', { ...existing }, { ...updated });
  });
  return { ...updated, hours: Number(updated.hours) };
}

export async function deleteTimeEntry(id: string, actor: AccessTokenPayload) {
  const transactionId = crypto.randomUUID();
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const existing = await getOwnedEntry(trx, id, actor);
    await trx`DELETE FROM time_entries WHERE id = ${id}`;
    await audit(trx, actor.userId, transactionId, 'time_entries', id, 'DELETE', { ...existing }, null);
  });
}
