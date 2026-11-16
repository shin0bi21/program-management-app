import { sql } from '../../../db/client';
import type { ContactType, DiscoverySource, LeadOrigin, LeadStatus, LeadSubmitterRole } from '../../../types/database';

export interface LeadRow {
  id: string;
  origin: LeadOrigin;
  youthFirstName: string;
  youthLastName: string;
  school: string;
  contactPhoneNumber: string;
  contactRelationship: ContactType;
  discoverySource: DiscoverySource;
  notes: string | null;
  status: LeadStatus;
  statusUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  convertedYouthId: string | null;
  submittedByRole: LeadSubmitterRole;
  dateOfBirth: string | null;

  age: number | null;
  recommendedProgramId: string | null;
  recommendedProgram: string | null;
}

/**
 * Builds canonical lead rows with current age and the recommended enrollment program.
 * @param appliedFilters - SQL restrictions against lead and recommended_program.
 * @param query - Database client; pass trx inside a transaction.
 * @returns Complete intake rows; unknown DOB leaves age and recommendation null, and no eligible program leaves the recommendation null.
 * @example getLeadRows(sql`lead.id = ${id}`, trx) // one canonical intake row
 */
export function getLeadRows(appliedFilters = sql`TRUE`, query = sql) {
  // 1. Load intake details and the first age-eligible enrollment program.
  const leadAge = query`EXTRACT(YEAR FROM AGE(CURRENT_DATE, lead.date_of_birth))::int`;
  return query<LeadRow[]>`
    SELECT
      lead.id,
      lead.origin,
      lead.youth_first_name,
      lead.youth_last_name,
      lead.school,
      lead.contact_phone_number,
      lead.contact_relationship,
      lead.discovery_source,
      lead.notes,
      lead.status,
      lead.status_updated_at,
      lead.created_at,
      lead.updated_at,
      lead.created_by,
      lead.updated_by,
      lead.converted_youth_id,
      lead.submitted_by_role,
      lead.date_of_birth,

      ${leadAge} AS age,
      recommended_program.id AS recommended_program_id,
      recommended_program.title AS recommended_program
    FROM leads lead
    LEFT JOIN LATERAL (
      SELECT
        program.id,
        program.title
      FROM programs program
      WHERE program.enrollment_required = TRUE
        AND ${leadAge} BETWEEN program.min_age AND program.max_age
      ORDER BY program.min_age DESC, program.max_age ASC, program.title ASC
      LIMIT 1
    ) recommended_program ON TRUE
    WHERE ${appliedFilters}
  `;
}
