import { sql } from '../../db/client';
import { NotFoundError, ConflictError, InternalServerError, isUniqueViolation } from '../../errors';
import type { SetSchoolInput } from '../../validation/schoolSchemas';

export { getSchoolReferenceData as getSchools } from '../referenceData/schoolReferenceData';

/**
 * Creates a school or updates the required target, returning its stored row.
 * Missing targets are 404; duplicate names are 409, including concurrent writes.
 * @example setSchool({ id: schoolId, name: 'Central School' }, actorId)
 */
export async function setSchool(data: SetSchoolInput, actorId: string) {
  const { id, name } = data;

  try {
    if (id) {
      const [school] = await sql`
        UPDATE schools
        SET name = ${name}, updated_by = ${actorId}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, name
      `;
      if (!school) throw new NotFoundError('School not found');
      return school;
    }

    const [school] = await sql`
      INSERT INTO schools (name, created_by, updated_by)
      VALUES (${name}, ${actorId}, ${actorId})
      RETURNING id, name
    `;
    if (!school) throw new InternalServerError('School creation returned no record');
    return school;
  } catch (error) {
    if (isUniqueViolation(error, 'schools_name_key')) {
      throw new ConflictError('A school with this name already exists', error);
    }
    throw error;
  }
}

/**
 * Deletes a required school; the database clears linked school references.
 * @example deleteSchool(schoolId) // rejects with 404 if the school is unavailable
 */
export async function deleteSchool(id: string) {
  const deleted = await sql`DELETE FROM schools WHERE id = ${id} RETURNING id`;
  if (!deleted.length) throw new NotFoundError('School not found');
}
