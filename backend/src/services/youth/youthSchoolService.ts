import { sql } from '../../db/client';
import { NotFoundError, ConflictError, InternalServerError, isUniqueViolation } from '../../errors';
import type { SetSchoolInput } from '../../validation/schoolSchemas';

export { getSchoolReferenceData as getSchools } from '../referenceData/schoolReferenceData';

/**
 * Creates a school or updates the required target, returning its stored row.
 * Missing targets are 404; duplicate names are 409, including concurrent writes.
 * @param data - Validated school name and optional ID; omit the ID to create a school.
 * @param userId - Existing user recorded as the creator or latest editor.
 * @returns The saved school's ID and name after the write completes.
 * @example await setSchool({ name: 'Central School' }, userId) // { id: newId, name: 'Central School' }
 */
export async function setSchool(data: SetSchoolInput, userId: string) {
  const { id, name } = data;

  try {
    if (id) {
      const [school] = await sql`
        UPDATE schools
        SET name = ${name}, updated_by = ${userId}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, name
      `;
      if (!school) throw new NotFoundError('School not found');

      return school;
    }

    const [school] = await sql`
      INSERT INTO schools (name, created_by, updated_by)
      VALUES (${name}, ${userId}, ${userId})
      RETURNING id, name
    `;
    if (!school) throw new InternalServerError('School creation returned no record');

    return school;
  } catch (error) {
    if (isUniqueViolation(error, 'schools_name_key')) {
      throw Object.assign(new ConflictError('A school with this name already exists'), { cause: error });
    }
    throw error;
  }
}

/**
 * Deletes a required school; the database clears linked school references.
 * Rejects with 404 when the school does not exist.
 * @param id - School to remove, including its links from youth profiles.
 * @returns Resolves after deletion and reference cleanup complete.
 * @example await deleteSchool('00000000-0000-0000-0000-000000000000') // 404 for a missing school
 */
export async function deleteSchool(id: string) {
  const deleted = await sql`DELETE FROM schools WHERE id = ${id} RETURNING id`;
  if (!deleted.length) throw new NotFoundError('School not found');
}
