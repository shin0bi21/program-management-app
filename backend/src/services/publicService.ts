import { sql } from '../db/client';
import type { CohortInterestSubmissions } from '../types/database';
import type { DbRow } from '../types/db';

type CohortInterestInput = {
  youthFirstName: string;
  youthLastName: string;
  age: number;
  school: string;
  email?: string;
  phoneNumber?: string;
  discoverySource: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';
  contactFirstName: string;
  contactLastName: string;
  contactPhoneNumber: string;
  contactRelationship: 'parent' | 'sibling' | 'guardian' | 'emergency';
  message?: string;
};

export async function submitCohortInterest(data: CohortInterestInput) {
  const email = data.email?.trim() || null;
  const phoneNumber = data.phoneNumber?.trim() || null;
  const school = data.school?.trim() || null;
  const discoverySource = data.discoverySource?.trim() || null;
  const contactFirstName = data.contactFirstName?.trim() || null;
  const contactLastName = data.contactLastName?.trim() || null;
  const contactPhoneNumber = data.contactPhoneNumber?.trim() || null;
  const contactRelationship = data.contactRelationship?.trim() || null;
  const message = data.message?.trim() || null;

  const rows = await sql<DbRow<CohortInterestSubmissions>[]>`
    INSERT INTO cohort_interest_submissions (
      youth_first_name,
      youth_last_name,
      age,
      school,
      email,
      phone_number,
      discovery_source,
      contact_first_name,
      contact_last_name,
      contact_phone_number,
      contact_relationship,
      message
    )
    VALUES (
      ${data.youthFirstName.trim()},
      ${data.youthLastName.trim()},
      ${data.age},
      ${school},
      ${email},
      ${phoneNumber},
      ${discoverySource},
      ${contactFirstName},
      ${contactLastName},
      ${contactPhoneNumber},
      ${contactRelationship}::contact_type,
      ${message}
    )
    RETURNING id, created_at, status
  `;

  return rows[0];
}
