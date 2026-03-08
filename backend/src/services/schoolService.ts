import { sql } from '../db/client';

export async function getSchools() {
  return sql`
    SELECT id, name, school_type, board
    FROM schools
    ORDER BY name ASC
  `;
}
