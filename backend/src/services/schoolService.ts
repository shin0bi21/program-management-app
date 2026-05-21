import { sql } from '../db/client';
import { NotFoundError, ConflictError } from '../errors';
import type { SetSchoolInput } from '../validation/schoolSchemas';

export async function getSchools() {
  return sql`
    SELECT id, name, board, address, postal_code
    FROM schools
    ORDER BY name ASC
  `;
}

export async function setSchool(data: SetSchoolInput, actorId: string) {
  const { id, name, board = null, address = null, postalCode = null } = data;

  if (id) {
    const existing = await sql<{ id: string }[]>`SELECT id FROM schools WHERE id = ${id} LIMIT 1`;
    if (!existing.length) throw new NotFoundError('School not found');

    const conflict = await sql<{ id: string }[]>`
      SELECT id FROM schools WHERE name = ${name} AND id != ${id} LIMIT 1
    `;
    if (conflict.length) throw new ConflictError('A school with this name already exists');

    const rows = await sql`
      UPDATE schools
      SET name = ${name},
          board = ${board},
          address = ${address},
          postal_code = ${postalCode},
          updated_by = ${actorId},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, board, address, postal_code
    `;
    return rows[0];
  }

  const conflict = await sql<{ id: string }[]>`SELECT id FROM schools WHERE name = ${name} LIMIT 1`;
  if (conflict.length) throw new ConflictError('A school with this name already exists');

  const rows = await sql`
    INSERT INTO schools (name, board, address, postal_code, created_by, updated_by)
    VALUES (${name}, ${board}, ${address}, ${postalCode}, ${actorId}, ${actorId})
    RETURNING id, name, board, address, postal_code
  `;
  return rows[0];
}

export async function deleteSchool(id: string) {
  const existing = await sql<{ id: string }[]>`SELECT id FROM schools WHERE id = ${id} LIMIT 1`;
  if (!existing.length) throw new NotFoundError('School not found');

  await sql`DELETE FROM schools WHERE id = ${id}`;
}
