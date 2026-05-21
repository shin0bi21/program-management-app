/**
 * Schools suite helpers.
 */
import { sql } from '../shared/db';

export { generateToken, generateExpiredToken } from '../shared/tokenHelpers';

export async function deleteTestSchool(schoolId: string): Promise<void> {
  await sql`DELETE FROM schools WHERE id = ${schoolId}`;
}

export { sql };
