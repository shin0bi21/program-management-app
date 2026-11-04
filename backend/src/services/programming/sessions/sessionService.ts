import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertCanAccessProgramCycle, assertCanAccessProgram, assertCanAccessSession } from '../../../policies/programAccessPolicy';
import { lockAssignmentProgram } from '../programCycles/assignmentService';
import { getSessionRowsByIds } from './sessionRecordQuery';
import { getProgramCycleRowsByKeys, type ProgramCycleKey } from '../programCycles/programCycleRecordQuery';
import type { AccessTokenPayload } from '../../../types/auth';
import type {
  CreateSessionInput,
  GenerateSessionsInput,
  UpdateSessionInput,
} from '../../../validation/programmingSchemas';

const intervalFor = {
  weekly: '1 week',
  biweekly: '2 weeks',
} as const;

const weekdayIndex = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const;

interface ProgramSchedule {
  defaultDayOfWeek: keyof typeof weekdayIndex;
  defaultStartTime: string;
  defaultEndTime: string;
  timezone: string;
  today: string;
  localTime: string;
}

export async function createProgramSession(programId: string, data: CreateSessionInput, actor: AccessTokenPayload) {
  await assertCanAccessProgram(actor, programId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    await lockAssignmentProgram(trx, programId, actor);

    const schedule = await getProgramSchedule(trx, programId);
    const date = resolveSessionDate(data.date, schedule);
    const assignments = await trx<ProgramCycleKey[]>`
      SELECT assignment.program_id, assignment.cycle_id
      FROM program_cycle_assignments assignment
      INNER JOIN program_cycles cycle ON cycle.id = assignment.cycle_id
      WHERE assignment.program_id = ${programId}
        AND ${date}::date BETWEEN cycle.starts_on AND cycle.ends_on
      ORDER BY cycle.id
      FOR UPDATE OF cycle, assignment
    `;
    if (!assignments.length) {
      throw new ConflictError('No assigned cycle covers this session date. Assign a cycle covering this date in Programming settings.');
    }
    if (assignments.length > 1) {
      throw new ConflictError('Multiple assigned cycles cover this session date. Adjust the overlapping cycle dates in Programming settings.');
    }

    return createScheduledSession(trx, programId, assignments[0].cycleId, data, actor, schedule, date);
  });
}

export async function createSession(programId: string, cycleId: string, data: CreateSessionInput, actor: AccessTokenPayload) {
  await assertCanAccessProgramCycle(actor, programId, cycleId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    await lockSessionAssignment(trx, programId, cycleId, actor);
    const [cycle] = await trx<{ startsOn: string; endsOn: string }[]>`
      SELECT cycle.starts_on::text, cycle.ends_on::text
      FROM program_cycles cycle
      WHERE cycle.id = ${cycleId}
    `;

    const schedule = await getProgramSchedule(trx, programId);
    const date = resolveSessionDate(data.date, schedule);
    if (date < cycle.startsOn || date > cycle.endsOn) {
      throw new ConflictError('Sessions must fall within the cycle date range');
    }

    return createScheduledSession(trx, programId, cycleId, data, actor, schedule, date);
  });
}

export async function generateSessions(programId: string, cycleId: string, data: GenerateSessionsInput, actor: AccessTokenPayload) {
  await assertCanAccessProgramCycle(actor, programId, cycleId);
  return sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);
    await lockSessionAssignment(trx, programId, cycleId, actor);
    const theme = data.theme;
    const cycles = await trx<{ startsOn: string; endsOn: string; timezone: string }[]>`
      SELECT cycle.starts_on::text AS starts_on, cycle.ends_on::text AS ends_on, program.timezone
      FROM program_cycles cycle
      CROSS JOIN programs program
      WHERE cycle.id = ${cycleId} AND program.id = ${programId}
    `;

    const cycle = cycles[0];
    const lastDate = data.frequency === 'once' ? data.startsOn : data.endsOn!;
    if (data.startsOn < cycle.startsOn || lastDate > cycle.endsOn) {
      throw new ConflictError('Sessions must fall within the cycle date range');
    }

    if (data.frequency === 'once') {
      await trx`
        INSERT INTO program_sessions (
          program_id, cycle_id, session_type_id, theme, starts_at, ends_at, created_by, updated_by
        )
        VALUES (
          ${programId}, ${cycleId},
          ${data.sessionTypeId},
          ${theme},
          (${data.startsOn}::date + ${data.startTime}::time) AT TIME ZONE ${cycle.timezone},
          (${data.startsOn}::date + ${data.endTime}::time) AT TIME ZONE ${cycle.timezone},
          ${actor.userId},
          ${actor.userId}
        )
      `;
    } else if (data.frequency === 'weekly' || data.frequency === 'biweekly') {
      const firstSessionDate = firstWeekdayOnOrAfter(data.startsOn, data.dayOfWeek!);
      if (firstSessionDate > data.endsOn!) {
        throw new ConflictError('No session dates match the selected weekday and date range');
      }
      await trx`
        INSERT INTO program_sessions (
          program_id, cycle_id, session_type_id, theme, starts_at, ends_at, created_by, updated_by
        )
        SELECT
          ${programId}, ${cycleId},
          ${data.sessionTypeId},
          ${theme},
          (session_date::date + ${data.startTime}::time) AT TIME ZONE ${cycle.timezone},
          (session_date::date + ${data.endTime}::time) AT TIME ZONE ${cycle.timezone},
          ${actor.userId},
          ${actor.userId}
        FROM generate_series(
          ${firstSessionDate}::date,
          ${data.endsOn!}::date,
          ${intervalFor[data.frequency]}::interval
        ) AS session_date
      `;
    } else {
      await trx`
        INSERT INTO program_sessions (
          program_id, cycle_id, session_type_id, theme, starts_at, ends_at, created_by, updated_by
        )
        SELECT
          ${programId}, ${cycleId},
          ${data.sessionTypeId},
          ${theme},
          (candidate.session_date + ${data.startTime}::time) AT TIME ZONE ${cycle.timezone},
          (candidate.session_date + ${data.endTime}::time) AT TIME ZONE ${cycle.timezone},
          ${actor.userId},
          ${actor.userId}
        FROM generate_series(
          date_trunc('month', ${data.startsOn}::date),
          date_trunc('month', ${data.endsOn!}::date),
          '1 month'::interval
        ) AS month_start
        CROSS JOIN LATERAL (
          SELECT month_start::date + ${data.dayOfMonth! - 1}::int AS session_date
        ) AS candidate
        WHERE candidate.session_date BETWEEN ${data.startsOn}::date AND ${data.endsOn!}::date
          AND EXTRACT(MONTH FROM candidate.session_date) = EXTRACT(MONTH FROM month_start)
      `;
    }

    const sessions = await trx`
      SELECT cs.id, cs.program_id, cs.cycle_id, cs.session_type_id, st.name AS session_type_name,
        cs.theme, cs.starts_at, cs.ends_at, cs.cancelled_at, cs.description
      FROM program_sessions cs
      INNER JOIN session_types st ON st.id = cs.session_type_id
      WHERE cs.program_id = ${programId} AND cs.cycle_id = ${cycleId}
        AND cs.session_type_id = ${data.sessionTypeId}
        AND cs.theme = ${theme}
        AND cs.starts_at >= (${data.startsOn}::date + ${data.startTime}::time) AT TIME ZONE ${cycle.timezone}
        AND cs.starts_at <= (${lastDate}::date + ${data.startTime}::time) AT TIME ZONE ${cycle.timezone}
      ORDER BY cs.starts_at
    `;
    if (!sessions.length) {
      throw new ConflictError('No session dates match the selected schedule and date range');
    }

    return { sessions, updatedProgramCycles: await getUpdatedProgramCycles(trx, actor, [{ programId, cycleId }]) };
  });
}

export async function updateSession(id: string, data: UpdateSessionInput, actor: AccessTokenPayload) {
  await assertCanAccessSession(actor, id);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const [session] = await trx<ProgramCycleKey[]>`SELECT program_id, cycle_id FROM program_sessions WHERE id = ${id}`;
    if (!session) throw new NotFoundError('Session not found');
    await lockSessionAssignment(trx, session.programId, session.cycleId, actor);

    const rows = await trx`
      UPDATE program_sessions
      SET session_type_id = COALESCE(${data.sessionTypeId ?? null}, session_type_id),
          theme = ${data.theme},
          starts_at = ${data.startsAt}, ends_at = ${data.endsAt},
          description = ${data.description ?? null}, updated_at = NOW(), updated_by = ${actor.userId}
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows.length) throw new NotFoundError('Session not found');
    const [saved] = await getSessionRowsByIds(trx, actor, [id]);
    if (!saved) throw new NotFoundError('Session not found');
    return { session: saved, updatedProgramCycles: await getUpdatedProgramCycles(trx, actor, [saved]) };
  });
}

export async function moveSessionDate(id: string, date: string, actor: AccessTokenPayload) {
  await assertCanAccessSession(actor, id);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const [lookup] = await trx<{ programId: string }[]>`
      SELECT session.program_id FROM program_sessions session
      WHERE session.id = ${id}
    `;
    if (!lookup) throw new NotFoundError('Session not found');
    await lockAssignmentProgram(trx, lookup.programId, actor);

    const schedule = await getProgramSchedule(trx, lookup.programId);
    const [session] = await trx<{
      cycleId: string; movable: boolean; startLocal: string; endLocal: string; endDate: string;
    }[]>`
      SELECT cycle_id, cancelled_at IS NULL AND starts_at > clock_timestamp() AS movable,
        (${date}::date + (starts_at AT TIME ZONE ${schedule.timezone})::time)::text AS start_local,
        (${date}::date + ((ends_at AT TIME ZONE ${schedule.timezone})::date
          - (starts_at AT TIME ZONE ${schedule.timezone})::date)
          + (ends_at AT TIME ZONE ${schedule.timezone})::time)::text AS end_local,
        (${date}::date + ((ends_at AT TIME ZONE ${schedule.timezone})::date
          - (starts_at AT TIME ZONE ${schedule.timezone})::date))::text AS end_date
      FROM program_sessions WHERE id = ${id} FOR UPDATE
    `;
    if (!session) throw new NotFoundError('Session not found');
    if (!session.movable) throw new ConflictError('Only future, non-cancelled sessions can be moved');

    const assignments = await trx<ProgramCycleKey[]>`
      SELECT assignment.program_id, assignment.cycle_id
      FROM program_cycle_assignments assignment
      JOIN program_cycles cycle ON cycle.id = assignment.cycle_id
      WHERE assignment.program_id = ${lookup.programId}
        AND ${date}::date BETWEEN cycle.starts_on AND cycle.ends_on
        AND ${session.endDate}::date BETWEEN cycle.starts_on AND cycle.ends_on
      ORDER BY cycle.id FOR UPDATE OF cycle, assignment
    `;
    if (!assignments.length) throw new ConflictError('No assigned cycle covers this session date');
    if (assignments.length > 1) throw new ConflictError('Multiple assigned cycles cover this session date');

    if (assignments[0].cycleId !== session.cycleId) {
      const [records] = await trx<{ recorded: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM attendance_records WHERE session_id = ${id})
          OR EXISTS (SELECT 1 FROM session_notes WHERE session_id = ${id})
          OR EXISTS (SELECT 1 FROM session_attachments WHERE session_id = ${id})
          OR EXISTS (SELECT 1 FROM time_entries WHERE session_id = ${id}) AS recorded
      `;
      if (records.recorded) throw new ConflictError('Sessions with recorded data cannot move to a different cycle');
    }

    const timing = await sessionTiming(trx, session.startLocal, session.endLocal, schedule.timezone);
    if (!timing.future) throw new ConflictError('Session destination must be in the future');

    await trx`
      UPDATE program_sessions SET cycle_id = ${assignments[0].cycleId},
        starts_at = ${timing.startsAt}, ends_at = ${timing.endsAt},
        updated_at = NOW(), updated_by = ${actor.userId}
      WHERE id = ${id}
      RETURNING id, program_id, cycle_id, starts_at, ends_at
    `;
    const [saved] = await getSessionRowsByIds(trx, actor, [id]);
    if (!saved) throw new NotFoundError('Session not found');
    return { session: saved, updatedProgramCycles: await getUpdatedProgramCycles(trx, actor, [{ programId: lookup.programId, cycleId: session.cycleId }, saved]) };
  });
}

export async function deleteSession(id: string, actor: AccessTokenPayload) {
  await assertCanAccessSession(actor, id);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const [lookup] = await trx<ProgramCycleKey[]>`SELECT program_id, cycle_id FROM program_sessions WHERE id = ${id}`;
    if (!lookup) throw new NotFoundError('Session not found');
    await lockSessionAssignment(trx, lookup.programId, lookup.cycleId, actor);
    const [session] = await trx<ProgramCycleKey[]>`SELECT program_id, cycle_id FROM program_sessions WHERE id = ${id} FOR UPDATE`;
    if (!session) throw new NotFoundError('Session not found');

    const attendance = await trx`SELECT 1 FROM attendance_records WHERE session_id = ${id} LIMIT 1`;
    if (attendance.length) {
      throw new ConflictError('Session cannot be deleted because attendance has been recorded');
    }
    const notes = await trx`SELECT 1 FROM session_notes WHERE session_id = ${id} LIMIT 1`;
    if (notes.length) {
      throw new ConflictError('Session cannot be deleted because session notes have been recorded');
    }
    const attachments = await trx`SELECT 1 FROM session_attachments WHERE session_id = ${id} LIMIT 1`;
    if (attachments.length) {
      throw new ConflictError('Session cannot be deleted because attachments have been added');
    }

    await trx`DELETE FROM program_sessions WHERE id = ${id}`;
    return { id, updatedProgramCycles: await getUpdatedProgramCycles(trx, actor, [session]) };
  });
}

export function getSessionTypes() {
  return sql`SELECT id, name FROM session_types ORDER BY name`;
}

function firstWeekdayOnOrAfter(date: string, weekday: keyof typeof weekdayIndex) {
  const first = new Date(`${date}T12:00:00.000Z`);
  const offset = (weekdayIndex[weekday] - first.getUTCDay() + 7) % 7;
  first.setUTCDate(first.getUTCDate() + offset);
  return first.toISOString().slice(0, 10);
}

async function lockSessionAssignment(trx: typeof sql, programId: string, cycleId: string, actor: AccessTokenPayload) {
  await lockAssignmentProgram(trx, programId, actor);
  await trx`SELECT id FROM program_cycles WHERE id = ${cycleId} FOR UPDATE`;
  const assignments = await trx`
    SELECT program_id FROM program_cycle_assignments
    WHERE program_id = ${programId} AND cycle_id = ${cycleId} FOR UPDATE
  `;
  if (!assignments.length) throw new NotFoundError('Program cycle not found');
}

async function getProgramSchedule(trx: typeof sql, programId: string): Promise<ProgramSchedule> {
  const [schedule] = await trx<ProgramSchedule[]>`
    SELECT default_day_of_week,
      to_char(default_start_time, 'HH24:MI') AS default_start_time,
      to_char(default_end_time, 'HH24:MI') AS default_end_time, timezone,
      (CURRENT_TIMESTAMP AT TIME ZONE timezone::text)::date::text AS today,
      to_char(CURRENT_TIMESTAMP AT TIME ZONE timezone::text, 'HH24:MI:SS') AS local_time
    FROM programs WHERE id = ${programId}
  `;
  return schedule;
}

function resolveSessionDate(date: string | undefined, schedule: ProgramSchedule) {
  if (date) return date;

  const nextDate = firstWeekdayOnOrAfter(schedule.today, schedule.defaultDayOfWeek);
  if (nextDate !== schedule.today || schedule.localTime < `${schedule.defaultStartTime}:00`) return nextDate;

  const nextWeek = new Date(`${nextDate}T12:00:00Z`);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  return nextWeek.toISOString().slice(0, 10);
}

async function createScheduledSession(
  trx: typeof sql,
  programId: string,
  cycleId: string,
  data: CreateSessionInput,
  actor: AccessTokenPayload,
  schedule: ProgramSchedule,
  date: string,
) {
  const startTime = data.startTime ?? schedule.defaultStartTime;
  const endTime = data.endTime ?? schedule.defaultEndTime;
  if (endTime <= startTime) throw new ConflictError('End time must be after start time');

  const timing = await sessionTiming(trx, `${date}T${startTime}`, `${date}T${endTime}`, schedule.timezone);

  const [session] = await trx`
    INSERT INTO program_sessions (
      program_id, cycle_id, session_type_id, theme, starts_at, ends_at, description, created_by, updated_by
    ) VALUES (
      ${programId}, ${cycleId}, ${data.sessionTypeId}, ${data.theme},
      ${timing.startsAt}, ${timing.endsAt},
      ${data.description ?? null}, ${actor.userId}, ${actor.userId}
    )
    RETURNING id, program_id, cycle_id, session_type_id, theme, starts_at, ends_at, description
  `;
  const [saved] = await getSessionRowsByIds(trx, actor, [session.id]);
  if (!saved) throw new NotFoundError('Session not found');
  return { ...saved, updatedProgramCycles: await getUpdatedProgramCycles(trx, actor, [{ programId, cycleId }]) };
}

function getUpdatedProgramCycles(trx: typeof sql, actor: AccessTokenPayload, keys: ProgramCycleKey[]) {
  return actor.permissions.includes('read:programs')
    ? getProgramCycleRowsByKeys(trx, actor, keys)
    : undefined;
}

async function sessionTiming(trx: typeof sql, startLocal: string, endLocal: string, timezone: string) {
  // Reject skipped or repeated wall-clock times instead of implicitly choosing a daylight-saving offset.
  const [timing] = await trx<{ valid: boolean; startsAt: Date; endsAt: Date; future: boolean }[]>`
    WITH times AS (
      SELECT ${startLocal}::timestamp AT TIME ZONE ${timezone} AS starts_at,
        ${endLocal}::timestamp AT TIME ZONE ${timezone} AS ends_at
    )
    SELECT starts_at, ends_at, starts_at > clock_timestamp() AS future, ends_at > starts_at
      AND starts_at AT TIME ZONE ${timezone} = ${startLocal}::timestamp
      AND ends_at AT TIME ZONE ${timezone} = ${endLocal}::timestamp
      AND NOT EXISTS (
        SELECT 1
        FROM (VALUES (starts_at), (ends_at)) AS boundary(instant)
        CROSS JOIN (VALUES (INTERVAL '-1 day'), (INTERVAL '1 day')) AS nearby(delta)
        CROSS JOIN LATERAL (
          SELECT ((boundary.instant + nearby.delta) AT TIME ZONE ${timezone})
            - ((boundary.instant AT TIME ZONE ${timezone}) + nearby.delta) AS offset_change
        ) AS transition
        WHERE transition.offset_change <> INTERVAL '0'
          AND (boundary.instant - transition.offset_change) AT TIME ZONE ${timezone}
            = boundary.instant AT TIME ZONE ${timezone}
      ) AS valid
    FROM times
  `;
  if (!timing.valid) throw new ConflictError('Session times are invalid in the program timezone');

  return timing;
}
