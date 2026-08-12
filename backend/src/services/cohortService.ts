import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import { assertCohortAccess, assertProgramAccess, programAccessPredicate } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type { CohortQuery, CreateCohortInput, CreateCycleInput, UpdateCohortInput, UpdateCycleInput } from '../validation/cohortSchemas';
import { cursorPage, decodeCursor } from './cursorPagination';

export function getCohorts(
  actor: AccessTokenPayload,
  query: CohortQuery,
) {
  const cursor = decodeCursor(query.cursor);
  const state = sql`CASE WHEN CURRENT_DATE < cycle.starts_on THEN 'upcoming' WHEN CURRENT_DATE > cycle.ends_on THEN 'completed' ELSE 'active' END`;
  const sortValue = {
    program: sql`LOWER(p.name)`, cohort: sql`LOWER(cycle.name)`, start: sql`cycle.starts_on::text`,
    end: sql`cycle.ends_on::text`, status: state,
  }[query.sort]!;
  const search = query.search ? `%${query.search}%` : null;
  return sql<Array<{ id: string; cursorValue: string }>>`
    SELECT
      pc.id,
      pc.program_id,
      p.name AS program_name,
      p.roster_mode,
      p.min_age,
      p.max_age,
      cycle.id AS cycle_id,
      cycle.name,
      cycle.name AS cycle_name,
      cycle.starts_on::text AS starts_on,
      cycle.ends_on::text AS ends_on,
      COUNT(DISTINCT ce.youth_id) FILTER (
        WHERE ce.enrolled_on <= CURRENT_DATE
          AND (ce.withdrawn_on IS NULL OR ce.withdrawn_on > CURRENT_DATE)
      )::int AS enrolled_count,
      (
        SELECT MIN(cs.starts_at)
        FROM cohort_sessions cs
        WHERE cs.cohort_id = pc.id
          AND cs.starts_at >= NOW()
          AND cs.cancelled_at IS NULL
      ) AS next_session_at,
      (
        SELECT cs.id
        FROM cohort_sessions cs
        WHERE cs.cohort_id = pc.id
          AND cs.starts_at >= NOW()
          AND cs.cancelled_at IS NULL
        ORDER BY cs.starts_at
        LIMIT 1
      ) AS next_session_id,
      (
        SELECT ROUND(
          100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late'))
          / NULLIF(COUNT(ar.id) FILTER (WHERE ar.status != 'excused'), 0),
          1
        )::float
        FROM cohort_sessions cs
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id
      ) AS average_attendance,
      (
        SELECT COUNT(ar.id)::int
        FROM cohort_sessions cs
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id
          AND ar.status IN ('present', 'late')
      ) AS attendance_attended_count,
      (
        SELECT COUNT(ar.id)::int
        FROM cohort_sessions cs
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id
          AND ar.status != 'excused'
      ) AS attendance_recorded_count,
      (
        SELECT COUNT(DISTINCT ar.youth_id)::int
        FROM cohort_sessions cs
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id
          AND ar.status IN ('present', 'late')
      ) AS unique_attendee_count,
      CASE
        WHEN CURRENT_DATE < cycle.starts_on THEN 'upcoming'
        WHEN CURRENT_DATE > cycle.ends_on THEN 'completed'
        ELSE 'active'
      END AS state,
      ${sortValue} AS cursor_value
    FROM program_cohorts pc
    INNER JOIN programs p ON p.id = pc.program_id
    INNER JOIN program_cycles cycle ON cycle.id = pc.cycle_id
    LEFT JOIN cohort_enrollments ce ON ce.cohort_id = pc.id
    WHERE ${query.programId ? sql`pc.program_id = ${query.programId}` : sql`TRUE`}
      AND ${query.scope === 'all' ? sql`TRUE` : programAccessPredicate(actor, sql`pc.program_id`)}
      AND ${query.cycleId ? sql`pc.cycle_id = ${query.cycleId}` : sql`TRUE`}
      AND ${search ? sql`(cycle.name ILIKE ${search} OR p.name ILIKE ${search})` : sql`TRUE`}
      AND ${query.status ? sql`${state} = ${query.status}` : sql`TRUE`}
      AND ${cursor ? (query.direction === 'asc'
        ? sql`(${sortValue}, pc.id) > (${cursor.value}, ${cursor.id}::uuid)`
        : sql`(${sortValue}, pc.id) < (${cursor.value}, ${cursor.id}::uuid)`) : sql`TRUE`}
    GROUP BY pc.id, p.id, cycle.id
    ORDER BY ${sortValue} ${query.direction === 'asc' ? sql`ASC` : sql`DESC`}, pc.id ${query.direction === 'asc' ? sql`ASC` : sql`DESC`}
    ${query.limit ? sql`LIMIT ${query.limit + 1}` : sql``}
  `.then(rows => query.limit ? cursorPage(rows, query.limit) : rows.map(({ cursorValue: _cursorValue, ...row }) => row));
}

export async function createCohort(data: CreateCohortInput, actor: AccessTokenPayload) {
  await assertProgramAccess(actor, data.programId);
  const rows = await sql`
    INSERT INTO program_cohorts (
      program_id, cycle_id, created_by, updated_by
    )
    VALUES (
      ${data.programId}, ${data.cycleId}, ${actor.userId}, ${actor.userId}
    )
    RETURNING
      id,
      program_id,
      cycle_id,
      (SELECT name FROM program_cycles WHERE id = ${data.cycleId}) AS name,
      (SELECT name FROM program_cycles WHERE id = ${data.cycleId}) AS cycle_name,
      (SELECT starts_on::text FROM program_cycles WHERE id = ${data.cycleId}) AS starts_on,
      (SELECT ends_on::text FROM program_cycles WHERE id = ${data.cycleId}) AS ends_on,
      (SELECT roster_mode FROM programs WHERE id = ${data.programId}) AS roster_mode,
      (SELECT min_age FROM programs WHERE id = ${data.programId}) AS min_age,
      (SELECT max_age FROM programs WHERE id = ${data.programId}) AS max_age
  `;
  return rows[0];
}

export async function updateCohort(id: string, data: UpdateCohortInput, actor: AccessTokenPayload) {
  await assertCohortAccess(actor, id);
  const sessionsOutsideCycle = await sql`
    SELECT 1
    FROM cohort_sessions session
    INNER JOIN program_cycles cycle ON cycle.id = ${data.cycleId}
    WHERE session.cohort_id = ${id}
      AND (
        (session.starts_at AT TIME ZONE 'America/Toronto')::date < cycle.starts_on
        OR (session.ends_at AT TIME ZONE 'America/Toronto')::date > cycle.ends_on
      )
    LIMIT 1
  `;
  if (sessionsOutsideCycle.length) {
    throw new ConflictError('Cohort cycle must contain all existing sessions');
  }
  const rows = await sql`
    UPDATE program_cohorts
    SET cycle_id = ${data.cycleId},
        updated_at = NOW(), updated_by = ${actor.userId}
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) throw new NotFoundError('Cohort not found');
  return rows[0];
}

export function getProgramCycles() {
  return sql<Array<{ id: string; name: string; startsOn: string; endsOn: string; state: 'active' | 'upcoming' | 'completed' }>>`
    SELECT id, name, starts_on::text AS starts_on, ends_on::text AS ends_on,
      CASE WHEN CURRENT_DATE < starts_on THEN 'upcoming' WHEN CURRENT_DATE > ends_on THEN 'completed' ELSE 'active' END AS state
    FROM program_cycles
    ORDER BY starts_on DESC, name, id
  `;
}

export async function createProgramCycle(data: CreateCycleInput, actor: AccessTokenPayload) {
  const rows = await sql`
    INSERT INTO program_cycles (name, starts_on, ends_on, created_by, updated_by)
    VALUES (${data.name}, ${data.startsOn}, ${data.endsOn}, ${actor.userId}, ${actor.userId})
    RETURNING id, name, starts_on::text AS starts_on, ends_on::text AS ends_on
  `;
  return rows[0];
}

export async function updateProgramCycle(id: string, data: UpdateCycleInput, actor: AccessTokenPayload) {
  const rows = await sql`
    UPDATE program_cycles
    SET name = ${data.name}, starts_on = ${data.startsOn}, ends_on = ${data.endsOn}, updated_at = NOW(), updated_by = ${actor.userId}
    WHERE id = ${id}
    RETURNING id, name, starts_on::text AS starts_on, ends_on::text AS ends_on
  `;
  if (!rows.length) throw new NotFoundError('Cycle not found');
  return rows[0];
}

export async function deleteProgramCycle(id: string) {
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const cycles = await trx`SELECT id FROM program_cycles WHERE id = ${id} FOR UPDATE`;
    if (!cycles.length) throw new NotFoundError('Cycle not found');

    const dependencies = await trx`
      SELECT
        EXISTS (SELECT 1 FROM program_cohorts WHERE cycle_id = ${id})
        OR EXISTS (SELECT 1 FROM time_entries WHERE cycle_id = ${id})
        AS in_use
    `;
    if (dependencies[0].inUse) {
      throw new ConflictError('Cycle cannot be deleted because it is still in use');
    }

    await trx`DELETE FROM program_cycles WHERE id = ${id}`;
  });
}

export async function deleteCohort(id: string, actor: AccessTokenPayload) {
  await assertCohortAccess(actor, id);
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const cohorts = await trx`SELECT id FROM program_cohorts WHERE id = ${id} FOR UPDATE`;
    if (!cohorts.length) throw new NotFoundError('Cohort not found');
    const attendance = await trx`
      SELECT 1 FROM attendance_records ar
      INNER JOIN cohort_sessions cs ON cs.id = ar.session_id
      WHERE cs.cohort_id = ${id} LIMIT 1
    `;
    if (attendance.length) {
      throw new ConflictError('Cohort cannot be deleted because one or more sessions have attendance');
    }
    const notes = await trx`
      SELECT 1 FROM session_notes sn
      INNER JOIN cohort_sessions cs ON cs.id = sn.session_id
      WHERE cs.cohort_id = ${id} LIMIT 1
    `;
    if (notes.length) {
      throw new ConflictError('Cohort cannot be deleted because one or more sessions have notes');
    }
    await trx`DELETE FROM cohort_enrollments WHERE cohort_id = ${id}`;
    await trx`DELETE FROM program_cohorts WHERE id = ${id}`;
  });
}
