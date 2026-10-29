import crypto from 'crypto';
import { sql, asTransactionSql } from '../../../db/client';
import { audit } from '../../shared/auditService';
import { ConflictError, ForbiddenError, InternalServerError, NotFoundError } from '../../../errors';
import type { AccessTokenPayload } from '../../../types/auth';
import type {
  SetHoursInput,
  HoursCategory,
  HoursDashboardQuery,
  HoursCalendarQuery,
  HoursSessionQuery,
  UpdateHoursPlacementInput,
} from '../../../validation/hoursSchemas';
import { assertCanSetHours, hoursReadScopePredicate } from '../../../policies/hoursPolicy';
import { canWriteTaskFor } from '../../../policies/taskPolicy';
import { getTask } from '../tasks/taskService';
import { getBiweeklyPayPeriod } from './payPeriods';
import { getStaffReferenceData } from '../../referenceData/staffReferenceData';
import {
  getHoursRecord,
  hoursRowToEntry,
  hoursRowToTableRow,
  hoursRecordColumns,
  hoursRecordFrom,
  type HoursRow,
} from './hoursRecordQuery';
import {
  getHoursCategoryLabel,
  HOURS_CATEGORY_OPTIONS,
  HOURS_ENTRY_TYPE_OPTIONS,
} from './hoursReferenceData';
import { hoursFilterPredicate } from './hoursListService';

export async function getHoursCalendarData(actor: AccessTokenPayload, query: HoursCalendarQuery) {
  const rows = await sql<HoursRow[]>`
    SELECT ${hoursRecordColumns}
    ${hoursRecordFrom}
    WHERE ${query.start && query.end
      ? sql`entry.work_date BETWEEN ${query.start}::date AND ${query.end}::date`
      : sql`TRUE`}
      ${hoursFilterPredicate(query)}
      AND ${hoursReadScopePredicate(actor, sql`entry.staff_id`)}
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
      categoryLabel: getHoursCategoryLabel(row.category),
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      sessionId: row.sessionId,
      sessionLabel: row.sessionLabel,
      hours: Number(row.hours),
      note: row.note,
    });
  });

  return data;
}

export async function setHours(
  input: SetHoursInput,
  actor: AccessTokenPayload,
  id?: string,
) {
  assertCanSetHours(actor, input.staffId);
  await assertActiveStaffResource(input.staffId);
  const transactionId = crypto.randomUUID();
  let saved!: HoursRow;
  let updatedTasks: Awaited<ReturnType<typeof getTask>>[] = [];
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const scope = await resolveHoursScope(input, trx);
    await assertProgramExists(scope.programId, trx);
    const cycleId = await resolveCycleForWorkDate(scope.workDate, scope.programId, trx);
    const existing = id ? await getOwnedEntry(trx, id, actor) : null;
    const savedId = id
      ? await updateHoursRecord(trx, id, input, scope, cycleId, actor.userId)
      : await insertHoursRecord(trx, input, scope, cycleId, actor.userId);
    saved = await getHoursRecord(savedId, trx);
    const completeTask = !id && input.source === 'task' && input.completeTask;
    await completeTaskFromHours(scope.taskId, completeTask, input.staffId, trx, actor, transactionId);
    await audit(
      trx,
      actor.userId,
      transactionId,
      'time_entries',
      saved.id,
      id ? 'UPDATE' : 'INSERT',
      existing ? { ...existing } : null,
      { ...saved },
    );

    updatedTasks = await getAffectedTasks([existing?.taskId, scope.taskId], actor, trx);
  });
  return {
    ...hoursRowToEntry(saved),
    tableRow: hoursRowToTableRow(saved),
    ...(updatedTasks.length ? { updatedTasks } : {}),
  };
}

export async function updateHoursPlacement(
  id: string,
  input: UpdateHoursPlacementInput,
  actor: AccessTokenPayload,
) {
  const transactionId = crypto.randomUUID();
  let updated!: HoursRow;
  let updatedTasks: Awaited<ReturnType<typeof getTask>>[] = [];
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const existing = await getOwnedEntry(trx, id, actor);
    if (existing.sessionId && input.workDate !== existing.workDate) {
      throw new ConflictError('Session time must stay on the session date');
    }
    const cycleId = await resolveCycleForWorkDate(input.workDate, existing.programId, trx);
    await trx`
      UPDATE time_entries
      SET work_date = ${input.workDate}, cycle_id = ${cycleId}, updated_by = ${actor.userId}, updated_at = NOW()
      WHERE id = ${id}
    `;
    updated = await getHoursRecord(id, trx);
    await audit(trx, actor.userId, transactionId, 'time_entries', id, 'UPDATE', { ...existing }, { ...updated });
    updatedTasks = await getAffectedTasks([existing.taskId], actor, trx);
  });
  return {
    ...hoursRowToEntry(updated),
    tableRow: hoursRowToTableRow(updated),
    ...(updatedTasks.length ? { updatedTasks } : {}),
  };
}

export async function deleteHours(id: string, actor: AccessTokenPayload) {
  const transactionId = crypto.randomUUID();
  let updatedTasks: Awaited<ReturnType<typeof getTask>>[] = [];
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const existing = await getOwnedEntry(trx, id, actor);
    await trx`DELETE FROM time_entries WHERE id = ${id}`;
    await audit(trx, actor.userId, transactionId, 'time_entries', id, 'DELETE', { ...existing }, null);
    updatedTasks = await getAffectedTasks([existing.taskId], actor, trx);
  });
  return { message: 'Logged hours deleted', ...(updatedTasks.length ? { updatedTasks } : {}) };
}

export function getHoursReferenceData() {
  return { categories: HOURS_CATEGORY_OPTIONS, types: HOURS_ENTRY_TYPE_OPTIONS };
}

export async function getHoursSessions(actor: AccessTokenPayload, query: HoursSessionQuery) {
  assertCanSetHours(actor, query.staffId);
  await assertActiveStaffResource(query.staffId);
  return sql<Array<{
    id: string; label: string; programId: string; programName: string; workDate: string; startsAt: string;
  }>>`
    SELECT session.id,
      session.theme AS label,
      program.id AS program_id, program.name AS program_name,
      (session.starts_at AT TIME ZONE 'America/Toronto')::date::text AS work_date,
      session.starts_at::text AS starts_at
    FROM cohort_sessions session
    INNER JOIN program_cohorts cohort ON cohort.id = session.cohort_id
    INNER JOIN programs program ON program.id = cohort.program_id
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

export async function getHoursDashboardData(actor: AccessTokenPayload, query: HoursDashboardQuery) {
  const readableStaff = await getStaffReferenceData(actor, 'hours');
  if (!readableStaff.some(resource => resource.id === query.staffId)) {
    throw new NotFoundError('Hours overview not found');
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
    category: HoursCategory | null;
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
  if (!rows.length) throw new NotFoundError('Hours overview not found');

  const payPeriodBreakdown = rows.flatMap(row => row.category && Number(row.periodHours) > 0
    ? [{ label: getHoursCategoryLabel(row.category), hours: Number(row.periodHours) }]
    : []).sort((left, right) => right.hours - left.hours || left.label.localeCompare(right.label));
  const periodCount = Number(rows[0].periodCount);
  const biweeklyBreakdown = rows.flatMap(row => row.category && Number(row.cycleHours) > 0
    ? [{ label: getHoursCategoryLabel(row.category), hours: Number(row.cycleHours) / periodCount }]
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

type ResolvedHoursScope = Awaited<ReturnType<typeof resolveHoursScope>>;

async function insertHoursRecord(
  trx: typeof sql,
  input: SetHoursInput,
  scope: ResolvedHoursScope,
  cycleId: string,
  actorId: string,
) {
  const [created] = await trx<{ id: string }[]>`
    INSERT INTO time_entries (
      staff_id, program_id, cycle_id, category, task_id, session_id,
      work_date, hours, note, created_by, updated_by
    )
    VALUES (
      ${input.staffId}, ${scope.programId}, ${cycleId}, ${scope.category}, ${scope.taskId},
      ${scope.sessionId}, ${scope.workDate}, ${input.hours}, ${input.note}, ${actorId}, ${actorId}
    )
    RETURNING id
  `;
  return created.id;
}

async function updateHoursRecord(
  trx: typeof sql,
  id: string,
  input: SetHoursInput,
  scope: ResolvedHoursScope,
  cycleId: string,
  actorId: string,
) {
  const [updated] = await trx<{ id: string }[]>`
    UPDATE time_entries
    SET staff_id = ${input.staffId},
      program_id = ${scope.programId},
      cycle_id = ${cycleId},
      category = ${scope.category},
      task_id = ${scope.taskId},
      session_id = ${scope.sessionId},
      work_date = ${scope.workDate},
      hours = ${input.hours},
      note = ${input.note},
      updated_by = ${actorId},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return updated.id;
}

async function resolveHoursScope(input: SetHoursInput, db: typeof sql) {
  if (input.source === 'regular') return {
    programId: input.programId, category: input.category,
    taskId: null, sessionId: null, workDate: input.workDate,
  };
  if (input.source === 'session') {
    const rows = await db<Array<{ programId: string; workDate: string }>>`
      SELECT cohort.program_id,
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
      taskId: null, sessionId: input.sessionId,
    };
  }
  const rows = await db<Array<{ category: string; programId: string | null; startDate: string; dueDate: string }>>`
    SELECT task.category, task.program_id,
      task.start_date::text, task.due_date::text
    FROM tasks task
    WHERE task.id = ${input.taskId}
      AND task.staff_id = ${input.staffId}
      AND task.status = 'open'
    LIMIT 1
    FOR UPDATE OF task
  `;
  if (!rows.length) throw new NotFoundError('Assigned task not found');
  const task = rows[0];
  return {
    programId: task.programId, category: task.category as HoursCategory,
    taskId: input.taskId, sessionId: null, workDate: input.workDate,
  };
}

async function completeTaskFromHours(
  taskId: string | null,
  completeTask: boolean,
  staffId: string,
  trx: typeof sql,
  actor: AccessTokenPayload,
  transactionId: string,
) {
  if (!taskId || !completeTask) return;
  if (!canWriteTaskFor(actor, staffId)) {
    throw new ForbiddenError('Task write permission is required to complete a task');
  }
  await trx`
    UPDATE tasks
    SET status = 'completed', completed_at = NOW(), updated_by = ${actor.userId}, updated_at = NOW()
    WHERE id = ${taskId}
  `;
  await audit(trx, actor.userId, transactionId, 'tasks', taskId, 'UPDATE',
    { status: 'open', staffId }, { status: 'completed', staffId });
}

// Domain validation
async function assertActiveStaffResource(staffId: string) {
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

async function assertProgramExists(programId: string | null, db: typeof sql = sql) {
  if (!programId) return;
  const rows = await db<{ id: string }[]>`SELECT id FROM programs WHERE id = ${programId} LIMIT 1`;
  if (!rows.length) throw new NotFoundError('Program not found');
}

async function resolveCycleForWorkDate(workDate: string, programId: string | null, db: typeof sql = sql) {
  const rows = await db<{ id: string }[]>`
    SELECT cycle.id
    FROM program_cycles cycle
    WHERE ${workDate}::date BETWEEN cycle.starts_on AND cycle.ends_on
      AND ${programId ? sql`EXISTS (
        SELECT 1 FROM program_cohorts cohort
        WHERE cohort.program_id = ${programId} AND cohort.cycle_id = cycle.id
      )` : sql`TRUE`}
    ORDER BY cycle.starts_on, cycle.id
    LIMIT 2
  `;
  if (!rows.length) throw new ConflictError('No cycle covers the selected work date');
  if (rows.length > 1) throw new ConflictError('Multiple cycles cover the selected work date');
  return rows[0].id;
}

async function getOwnedEntry(trx: typeof sql, id: string, actor: AccessTokenPayload) {
  const rows = await trx<HoursRow[]>`
    SELECT ${hoursRecordColumns}
    ${hoursRecordFrom}
    WHERE entry.id = ${id}
    LIMIT 1
    FOR UPDATE OF entry
  `;
  if (!rows.length) throw new NotFoundError('Logged hours not found');
  assertCanSetHours(actor, rows[0].staffId);
  return rows[0];
}

async function getAffectedTasks(
  taskIds: Array<string | null | undefined>,
  actor: AccessTokenPayload,
  trx: typeof sql,
) {
  if (!actor.permissions.includes('read:tasks')) return [];

  const ids = [...new Set(taskIds.filter((id): id is string => Boolean(id)))];
  return Promise.all(ids.map(id => getTask(id, actor, trx)));
}
