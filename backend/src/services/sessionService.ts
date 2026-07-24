import crypto from 'crypto';
import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import type { GenerateActivitySessionsInput, SessionListQuery } from '../validation/cohortSchemas';
import { audit } from './auditService';

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

function firstWeekdayOnOrAfter(date: string, weekday: keyof typeof weekdayIndex) {
  const first = new Date(`${date}T12:00:00.000Z`);
  const offset = (weekdayIndex[weekday] - first.getUTCDay() + 7) % 7;
  first.setUTCDate(first.getUTCDate() + offset);
  return first.toISOString().slice(0, 10);
}

export async function generateActivitySessions(
  cohortId: string,
  data: GenerateActivitySessionsInput,
  actorId: string,
) {
  const transactionId = crypto.randomUUID();

  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const cohorts = await trx<{ startsOn: string; endsOn: string }[]>`
      SELECT starts_on::text AS starts_on, ends_on::text AS ends_on
      FROM program_cohorts
      WHERE id = ${cohortId}
      FOR UPDATE
    `;
    if (!cohorts.length) throw new NotFoundError('Cohort not found');

    const cohort = cohorts[0];
    const lastDate = data.frequency === 'once' ? data.startsOn : data.endsOn!;
    if (data.startsOn < cohort.startsOn || lastDate > cohort.endsOn) {
      throw new ConflictError('Activity sessions must fall within the cohort date range');
    }

    const activities = await trx<{ id: string }[]>`
      INSERT INTO cohort_activities (
        cohort_id, name, description, created_by, updated_by
      )
      VALUES (
        ${cohortId}, ${data.name}, ${data.description ?? null}, ${actorId}, ${actorId}
      )
      RETURNING id
    `;
    const activityId = activities[0].id;

    if (data.frequency === 'once') {
      await trx`
        INSERT INTO cohort_sessions (
          activity_id, focus, starts_at, ends_at, created_by, updated_by
        )
        VALUES (
          ${activityId},
          ${data.focus ?? null},
          (${data.startsOn}::date + ${data.startTime}::time) AT TIME ZONE 'America/Toronto',
          (${data.startsOn}::date + ${data.endTime}::time) AT TIME ZONE 'America/Toronto',
          ${actorId},
          ${actorId}
        )
      `;
    } else if (data.frequency === 'weekly' || data.frequency === 'biweekly') {
      const firstSessionDate = firstWeekdayOnOrAfter(data.startsOn, data.dayOfWeek!);
      if (firstSessionDate > data.endsOn!) {
        throw new ConflictError('No session dates match the selected weekday and date range');
      }
      await trx`
        INSERT INTO cohort_sessions (
          activity_id, focus, starts_at, ends_at, created_by, updated_by
        )
        SELECT
          ${activityId},
          ${data.focus ?? null},
          (session_date::date + ${data.startTime}::time) AT TIME ZONE 'America/Toronto',
          (session_date::date + ${data.endTime}::time) AT TIME ZONE 'America/Toronto',
          ${actorId},
          ${actorId}
        FROM generate_series(
          ${firstSessionDate}::date,
          ${data.endsOn!}::date,
          ${intervalFor[data.frequency]}::interval
        ) AS session_date
      `;
    } else {
      await trx`
        INSERT INTO cohort_sessions (
          activity_id, focus, starts_at, ends_at, created_by, updated_by
        )
        SELECT
          ${activityId},
          ${data.focus ?? null},
          (candidate.session_date + ${data.startTime}::time) AT TIME ZONE 'America/Toronto',
          (candidate.session_date + ${data.endTime}::time) AT TIME ZONE 'America/Toronto',
          ${actorId},
          ${actorId}
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
      SELECT id, activity_id, focus, starts_at, ends_at, cancelled_at, notes
      FROM cohort_sessions
      WHERE activity_id = ${activityId}
      ORDER BY starts_at
    `;
    if (!sessions.length) {
      throw new ConflictError('No session dates match the selected schedule and date range');
    }

    await audit(trx, actorId, transactionId, 'cohort_activities', activityId, 'INSERT', null, {
      id: activityId,
      cohortId,
      name: data.name,
      frequency: data.frequency,
      dayOfWeek: data.dayOfWeek ?? null,
      dayOfMonth: data.dayOfMonth ?? null,
      sessionCount: sessions.length,
    });

    return { activityId, sessions };
  });
}

export function getSessions(start: string, end: string) {
  return sql`
    SELECT
      cs.id,
      cs.activity_id,
      ca.cohort_id,
      ca.name AS activity_name,
      cs.focus,
      pc.name AS cohort_name,
      p.id AS program_id,
      p.name AS program_name,
      cs.starts_at,
      cs.ends_at,
      cs.cancelled_at,
      cs.notes
    FROM cohort_sessions cs
    INNER JOIN cohort_activities ca ON ca.id = cs.activity_id
    INNER JOIN program_cohorts pc ON pc.id = ca.cohort_id
    INNER JOIN programs p ON p.id = pc.program_id
    WHERE cs.starts_at < ${end}::timestamptz
      AND cs.ends_at > ${start}::timestamptz
    ORDER BY cs.starts_at
  `;
}

export function getSessionList(filters: SessionListQuery) {
  const search = filters.search ? `%${filters.search}%` : null;
  const timing = filters.timing ?? 'upcoming';

  return sql`
    SELECT
      cs.id,
      cs.activity_id,
      ca.cohort_id,
      ca.name AS activity_name,
      cs.focus,
      pc.name AS cohort_name,
      p.id AS program_id,
      p.name AS program_name,
      cs.starts_at,
      cs.ends_at,
      cs.cancelled_at,
      cs.notes,
      COUNT(ar.id)::int AS attendance_marked_count,
      COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late'))::int AS attended_count,
      ROUND(
        100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late'))
        / NULLIF(COUNT(ar.id) FILTER (WHERE ar.status != 'excused'), 0),
        1
      )::float AS attendance_rate,
      CASE
        WHEN cs.cancelled_at IS NOT NULL THEN 'cancelled'
        WHEN cs.ends_at < NOW() THEN 'completed'
        ELSE 'upcoming'
      END AS state
    FROM cohort_sessions cs
    INNER JOIN cohort_activities ca ON ca.id = cs.activity_id
    INNER JOIN program_cohorts pc ON pc.id = ca.cohort_id
    INNER JOIN programs p ON p.id = pc.program_id
    LEFT JOIN attendance_records ar ON ar.session_id = cs.id
    WHERE ${filters.programId ? sql`pc.program_id = ${filters.programId}` : sql`TRUE`}
      AND ${filters.cohortId ? sql`pc.id = ${filters.cohortId}` : sql`TRUE`}
      AND ${timing === 'upcoming' ? sql`cs.starts_at >= NOW()` : timing === 'past' ? sql`cs.starts_at < NOW()` : sql`TRUE`}
      AND ${search ? sql`(
        ca.name ILIKE ${search}
        OR COALESCE(cs.focus, '') ILIKE ${search}
        OR pc.name ILIKE ${search}
        OR p.name ILIKE ${search}
      )` : sql`TRUE`}
    GROUP BY cs.id, ca.id, pc.id, p.id
    ORDER BY
      CASE WHEN ${timing} = 'past' THEN cs.starts_at END DESC,
      CASE WHEN ${timing} != 'past' THEN cs.starts_at END ASC
  `;
}
