import { sql } from '../db/client';
import type { ExpressionsOfInterest } from '../types/database';
import type { DbRow } from '../types/db';

type ExpressionOfInterestInput = {
  youthFirstName: string;
  youthLastName: string;
  age: number;
  school: string;
  submittedByRole: 'youth' | 'parent' | 'guardian';
  discoverySource: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';
  contactPhoneNumber: string;
  contactRelationship: 'parent' | 'sibling' | 'guardian' | 'emergency';
  notes?: string;
};

export async function submitExpressionOfInterest(data: ExpressionOfInterestInput) {
  const school = data.school?.trim() || null;
  const discoverySource = data.discoverySource?.trim() || null;
  const contactPhoneNumber = data.contactPhoneNumber?.trim() || null;
  const contactRelationship = data.contactRelationship?.trim() || null;
  const notes = data.notes?.trim() || null;

  const rows = await sql<DbRow<ExpressionsOfInterest>[]>`
    INSERT INTO expressions_of_interest (
      youth_first_name,
      youth_last_name,
      age,
      school,
      submitted_by_role,
      discovery_source,
      contact_phone_number,
      contact_relationship,
      notes
    )
    VALUES (
      ${data.youthFirstName.trim()},
      ${data.youthLastName.trim()},
      ${data.age},
      ${school},
      ${data.submittedByRole}::outreach_submitter_role,
      ${discoverySource},
      ${contactPhoneNumber},
      ${contactRelationship}::contact_type,
      ${notes}
    )
    RETURNING id, created_at, status
  `;

  return rows[0];
}
