import { sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import { programAccessPredicate } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type { CreateProgramInput, UpdateProgramInput } from '../validation/programSchemas';

export function getPrograms(actor: AccessTokenPayload, assignedOnly = false) {
  return sql`
    SELECT p.id, p.name, p.description, p.enrollment_required, p.min_age, p.max_age, p.default_day_of_week,
      to_char(p.default_start_time, 'HH24:MI') AS default_start_time,
      to_char(p.default_end_time, 'HH24:MI') AS default_end_time, p.timezone
    FROM programs p
    WHERE ${assignedOnly ? programAccessPredicate(actor, sql`p.id`) : sql`TRUE`}
    ORDER BY name ASC
  `;
}

export async function createProgram(data: CreateProgramInput) {
  const name = data.name.trim();
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM programs WHERE LOWER(name) = LOWER(${name}) LIMIT 1
  `;
  if (existing.length) throw new ConflictError('A program with this name already exists');

  const rows = await sql`
    INSERT INTO programs (name, description, enrollment_required, min_age, max_age, default_day_of_week, default_start_time, default_end_time, timezone)
    VALUES (
      ${name},
      ${data.description ?? null},
      ${data.enrollmentRequired},
      ${data.minAge ?? null},
      ${data.maxAge ?? null},
      ${data.defaultDayOfWeek}, ${data.defaultStartTime}, ${data.defaultEndTime}, ${data.timezone}
    )
    RETURNING id, name, description, enrollment_required, min_age, max_age, default_day_of_week,
      to_char(default_start_time, 'HH24:MI') AS default_start_time,
      to_char(default_end_time, 'HH24:MI') AS default_end_time, timezone
  `;
  return rows[0];
}

export async function updateProgram(id: string, data: UpdateProgramInput) {
  const name = data.name.trim();
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM programs WHERE LOWER(name) = LOWER(${name}) AND id != ${id} LIMIT 1
  `;
  if (existing.length) throw new ConflictError('A program with this name already exists');

  const rows = await sql`
    UPDATE programs
    SET name = ${name},
        description = ${data.description ?? null},
        enrollment_required = ${data.enrollmentRequired},
        min_age = ${data.minAge ?? null},
        max_age = ${data.maxAge ?? null},
        default_day_of_week = ${data.defaultDayOfWeek},
        default_start_time = ${data.defaultStartTime},
        default_end_time = ${data.defaultEndTime},
        timezone = ${data.timezone}
    WHERE id = ${id}
    RETURNING id, name, description, enrollment_required, min_age, max_age, default_day_of_week,
      to_char(default_start_time, 'HH24:MI') AS default_start_time,
      to_char(default_end_time, 'HH24:MI') AS default_end_time, timezone
  `;
  if (!rows.length) throw new NotFoundError('Program not found');
  return rows[0];
}
