import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import type { UpdateCohortInterestStatusInput } from '../validation/cohortInterestSchemas';

export async function getCohortInterestSubmissions() {
  return sql`
    SELECT
      id,
      youth_first_name,
      youth_last_name,
      contact_first_name,
      contact_last_name,
      contact_phone_number,
      contact_relationship,
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
      youth_first_name,
      youth_last_name,
      contact_first_name,
      contact_last_name,
      contact_phone_number,
      contact_relationship,
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

export async function convertCohortInterestSubmission(id: string, actorId: string) {
  return sql.begin(async (rawTx) => {
    const tx = asTransactionSql(rawTx);
    const submissions = await tx`
      SELECT
        id,
        youth_first_name,
        youth_last_name,
        age,
        school,
        email,
        phone_number,
        contact_first_name,
        contact_last_name,
        contact_phone_number,
        contact_relationship,
        discovery_source,
        message,
        status
      FROM cohort_interest_submissions
      WHERE id = ${id}
      FOR UPDATE
    `;

    if (!submissions.length) {
      throw new NotFoundError('Cohort interest submission not found');
    }

    const submission = submissions[0];
    const existingLead = await tx`
      SELECT id
      FROM leads
      WHERE interest_submission_id = ${id}
      LIMIT 1
    `;
    if (existingLead.length) {
      throw new ConflictError('This interest submission has already been converted');
    }

    const leads = await tx`
      INSERT INTO leads (
        origin,
        interest_submission_id,
        youth_first_name,
        youth_last_name,
        age,
        school,
        response_email,
        response_phone_number,
        contact_first_name,
        contact_last_name,
        contact_phone_number,
        contact_relationship,
        discovery_source,
        notes,
        created_by,
        updated_by
      ) VALUES (
        'interest_submission',
        ${submission.id},
        ${submission.youthFirstName},
        ${submission.youthLastName},
        ${submission.age},
        ${submission.school},
        ${submission.email},
        ${submission.phoneNumber},
        ${submission.contactFirstName},
        ${submission.contactLastName},
        ${submission.contactPhoneNumber},
        ${submission.contactRelationship},
        ${submission.discoverySource},
        ${submission.message},
        ${actorId},
        ${actorId}
      )
      RETURNING
        id,
        origin,
        interest_submission_id,
        youth_first_name,
        youth_last_name,
        age,
        school,
        response_email,
        response_phone_number,
        contact_first_name,
        contact_last_name,
        contact_phone_number,
        contact_relationship,
        discovery_source,
        notes,
        status,
        status_updated_at,
        created_at,
        updated_at,
        created_by,
        updated_by
    `;

    await tx`
      UPDATE cohort_interest_submissions
      SET status = 'converted',
          status_updated_at = NOW(),
          updated_at = NOW(),
          updated_by = ${actorId}
      WHERE id = ${id}
    `;

    return leads[0];
  });
}
