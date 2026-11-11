import { sql } from '../../../db/client';
import type { Leads } from '../../../types/database';
import type { DbRow } from '../../../types/db';

export type LeadRow = DbRow<Omit<Leads,
  'date_of_birth' | 'expression_of_interest_id' | 'program_of_interest_id'
>> & {
  dateOfBirth: string | null;
  age: number | null;
  recommendedProgramId: string | null;
  recommendedProgram: string | null;
};

const leadAge = sql`EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))::int`;

export const recommendedProgramId = sql`(
  SELECT program.id
  FROM programs program
  WHERE program.enrollment_required = TRUE
    AND ${leadAge} BETWEEN program.min_age AND program.max_age
  ORDER BY program.min_age DESC, program.max_age ASC, program.name ASC
  LIMIT 1
)`;

const recommendedProgram = sql`(
  SELECT program.name
  FROM programs program
  WHERE program.enrollment_required = TRUE
    AND ${leadAge} BETWEEN program.min_age AND program.max_age
  ORDER BY program.min_age DESC, program.max_age ASC, program.name ASC
  LIMIT 1
)`;

export const leadRowColumns = sql`
  id,
  origin,
  youth_first_name,
  youth_last_name,
  school,
  contact_phone_number,
  contact_relationship,
  discovery_source,
  notes,
  status,
  status_updated_at,
  created_at,
  updated_at,
  created_by,
  updated_by,
  converted_youth_id,
  submitted_by_role,
  date_of_birth,

  ${leadAge} AS age,
  ${recommendedProgramId} AS recommended_program_id,
  ${recommendedProgram} AS recommended_program
`;

/**
 * Builds rows for table and calendar items.
 * @param appliedFilters - SQL filters supplied by the service.
 * @param query - Database client; pass trx inside a transaction.
 * @example getLeadRows(appliedFilters, trx)
 */
export function getLeadRows(appliedFilters = sql`TRUE`, query = sql) {
  return query<LeadRow[]>`
    SELECT ${leadRowColumns}
    FROM leads
    WHERE ${appliedFilters}
  `;
}
