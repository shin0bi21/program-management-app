import { sql } from '../db/client';
import type { CohortInterestSubmissions } from '../types/database';
import type { DbRow } from '../types/db';

type CohortInterestInput = {
  youthFirstName: string;
  youthLastName: string;
  age: number;
  school: string;
  discoverySource: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';
  contactFirstName: string;
  contactLastName: string;
  contactPhoneNumber: string;
  contactRelationship: 'parent' | 'sibling' | 'guardian' | 'emergency';
  notes?: string;
};

export async function submitCohortInterest(data: CohortInterestInput) {
  const school = data.school?.trim() || null;
  const discoverySource = data.discoverySource?.trim() || null;
  const contactFirstName = data.contactFirstName?.trim() || null;
  const contactLastName = data.contactLastName?.trim() || null;
  const contactPhoneNumber = data.contactPhoneNumber?.trim() || null;
  const contactRelationship = data.contactRelationship?.trim() || null;
  const notes = data.notes?.trim() || null;

  const rows = await sql<DbRow<CohortInterestSubmissions>[]>`
    INSERT INTO cohort_interest_submissions (
      youth_first_name,
      youth_last_name,
      age,
      school,
      discovery_source,
      contact_first_name,
      contact_last_name,
      contact_phone_number,
      contact_relationship,
      notes
    )
    VALUES (
      ${data.youthFirstName.trim()},
      ${data.youthLastName.trim()},
      ${data.age},
      ${school},
      ${discoverySource},
      ${contactFirstName},
      ${contactLastName},
      ${contactPhoneNumber},
      ${contactRelationship}::contact_type,
      ${notes}
    )
    RETURNING id, created_at, status
  `;

  return rows[0];
}
