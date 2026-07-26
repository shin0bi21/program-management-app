import { sql } from '../db/client';
import { ConflictError } from '../errors';
import { programAccessPredicate } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type { CreateProgramInput } from '../validation/programSchemas';

export function getPrograms(actor: AccessTokenPayload, assignedOnly = false) {
  return sql`
    SELECT p.id, p.name, p.description, p.roster_mode
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
    INSERT INTO programs (name, description, roster_mode)
    VALUES (${name}, ${data.description ?? null}, ${data.rosterMode ?? 'enrolled'})
    RETURNING id, name, description, roster_mode
  `;
  return rows[0];
}

/** Returns the editable default assignment for a lead created from public intake. */
export function suggestProgramNameForAge(age: number) {
  if (age >= 12 && age <= 15) return 'Soft Skills';
  if (age >= 16 && age <= 19) return 'Job Readiness';
  return null;
}
