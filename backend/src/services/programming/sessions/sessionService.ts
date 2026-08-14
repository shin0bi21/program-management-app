import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertCanAccessCohort, assertCanAccessSession } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type {
  GenerateSessionsInput,
  UpdateSessionInput,
} from '../../../validation/cohortSchemas';

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

export async function generateSessions(cohortId: string, data: GenerateSessionsInput, actor: AccessTokenPayload) {
  await assertCanAccessCohort(actor, cohortId);
  return sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);
    const theme = data.theme;
    const cohorts = await trx<{ startsOn: string; endsOn: string }[]>`
      SELECT cycle.starts_on::text AS starts_on, cycle.ends_on::text AS ends_on
      FROM program_cohorts cohort
      INNER JOIN program_cycles cycle ON cycle.id = cohort.cycle_id
      WHERE cohort.id = ${cohortId}
      FOR UPDATE OF cohort
    `;
    if (!cohorts.length) throw new NotFoundError('Cohort not found');

    const cohort = cohorts[0];
    const lastDate = data.frequency === 'once' ? data.startsOn : data.endsOn!;
    if (data.startsOn < cohort.startsOn || lastDate > cohort.endsOn) {
      throw new ConflictError('Sessions must fall within the cohort date range');
    }

    if (data.frequency === 'once') {
      await trx`
        INSERT INTO cohort_sessions (
          cohort_id, session_type_id, theme, starts_at, ends_at, created_by, updated_by
        )
        VALUES (
          ${cohortId},
          ${data.sessionTypeId},
          ${theme},
          (${data.startsOn}::date + ${data.startTime}::time) AT TIME ZONE 'America/Toronto',
          (${data.startsOn}::date + ${data.endTime}::time) AT TIME ZONE 'America/Toronto',
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
        INSERT INTO cohort_sessions (
          cohort_id, session_type_id, theme, starts_at, ends_at, created_by, updated_by
        )
        SELECT
          ${cohortId},
          ${data.sessionTypeId},
          ${theme},
          (session_date::date + ${data.startTime}::time) AT TIME ZONE 'America/Toronto',
          (session_date::date + ${data.endTime}::time) AT TIME ZONE 'America/Toronto',
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
        INSERT INTO cohort_sessions (
          cohort_id, session_type_id, theme, starts_at, ends_at, created_by, updated_by
        )
        SELECT
          ${cohortId},
          ${data.sessionTypeId},
          ${theme},
          (candidate.session_date + ${data.startTime}::time) AT TIME ZONE 'America/Toronto',
          (candidate.session_date + ${data.endTime}::time) AT TIME ZONE 'America/Toronto',
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
      SELECT cs.id, cs.cohort_id, cs.session_type_id, st.name AS session_type_name,
        cs.theme, cs.starts_at, cs.ends_at, cs.cancelled_at, cs.description
      FROM cohort_sessions cs
      INNER JOIN session_types st ON st.id = cs.session_type_id
      WHERE cs.cohort_id = ${cohortId}
        AND cs.session_type_id = ${data.sessionTypeId}
        AND cs.theme = ${theme}
        AND cs.starts_at >= (${data.startsOn}::date + ${data.startTime}::time) AT TIME ZONE 'America/Toronto'
        AND cs.starts_at <= (${lastDate}::date + ${data.startTime}::time) AT TIME ZONE 'America/Toronto'
      ORDER BY cs.starts_at
    `;
    if (!sessions.length) {
      throw new ConflictError('No session dates match the selected schedule and date range');
    }

    return { sessions };
  });
}

export async function updateSession(id: string, data: UpdateSessionInput, actor: AccessTokenPayload) {
  await assertCanAccessSession(actor, id);
  const rows = await sql`
    UPDATE cohort_sessions
    SET session_type_id = COALESCE(${data.sessionTypeId ?? null}, session_type_id),
        theme = ${data.theme},
        starts_at = ${data.startsAt}, ends_at = ${data.endsAt},
        description = ${data.description ?? null}, updated_at = NOW(), updated_by = ${actor.userId}
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) throw new NotFoundError('Session not found');
  return rows[0];
}

export async function deleteSession(id: string, actor: AccessTokenPayload) {
  await assertCanAccessSession(actor, id);
  const attendance = await sql`SELECT 1 FROM attendance_records WHERE session_id = ${id} LIMIT 1`;
  if (attendance.length) {
    throw new ConflictError('Session cannot be deleted because attendance has been recorded');
  }
  const notes = await sql`SELECT 1 FROM session_notes WHERE session_id = ${id} LIMIT 1`;
  if (notes.length) {
    throw new ConflictError('Session cannot be deleted because session notes have been recorded');
  }
  const attachments = await sql`SELECT 1 FROM session_attachments WHERE session_id = ${id} LIMIT 1`;
  if (attachments.length) {
    throw new ConflictError('Session cannot be deleted because attachments have been added');
  }
  const rows = await sql`DELETE FROM cohort_sessions WHERE id = ${id} RETURNING id`;
  if (!rows.length) throw new NotFoundError('Session not found');
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
