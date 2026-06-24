import { sql } from '../db/client';
import type { CohortInterestSubmissions } from '../types/database';
import type { DbRow } from '../types/db';
import { sendCohortInterestEmail } from '../utils/emailService';

type CohortInterestInput = {
  youthName: string;
  parentName?: string;
  age: number;
  school?: string;
  email?: string;
  phoneNumber?: string;
  discoverySource?: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';
  message?: string;
};

export async function submitCohortInterest(data: CohortInterestInput) {
  const email = data.email?.trim() || null;
  const phoneNumber = data.phoneNumber?.trim() || null;
  const parentName = data.parentName?.trim() || null;
  const school = data.school?.trim() || null;
  const discoverySource = data.discoverySource?.trim() || null;
  const message = data.message?.trim() || null;

  const rows = await sql<DbRow<CohortInterestSubmissions>[]>`
    INSERT INTO cohort_interest_submissions (
      youth_name,
      parent_name,
      age,
      school,
      email,
      phone_number,
      discovery_source,
      message
    )
    VALUES (
      ${data.youthName},
      ${parentName},
      ${data.age},
      ${school},
      ${email},
      ${phoneNumber},
      ${discoverySource},
      ${message}
    )
    RETURNING id, created_at, status
  `;

  try {
    await sendCohortInterestEmail(data);
  } catch (error) {
    console.error('Failed to send cohort interest notification email', error);
  }

  return rows[0];
}
