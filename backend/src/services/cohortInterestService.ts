import { sql } from '../db/client';
import { NotFoundError } from '../errors';
import type { UpdateCohortInterestStatusInput } from '../validation/cohortInterestSchemas';

export async function getCohortInterestSubmissions() {
  return sql`
    SELECT
      id,
      youth_name,
      parent_name,
      age,
      school,
      email,
      phone_number,
      discovery_source,
      message,
      status,
      created_at,
      status_updated_at
    FROM cohort_interest_submissions
    ORDER BY created_at DESC
  `;
}

export async function updateCohortInterestStatus(id: string, data: UpdateCohortInterestStatusInput) {
  const rows = await sql`
    UPDATE cohort_interest_submissions
    SET
      status = ${data.status},
      status_updated_at = NOW(),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING
      id,
      youth_name,
      parent_name,
      age,
      school,
      email,
      phone_number,
      discovery_source,
      message,
      status,
      created_at,
      status_updated_at
  `;

  if (!rows.length) {
    throw new NotFoundError('Cohort interest submission not found');
  }

  return rows[0];
}
