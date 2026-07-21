import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import type { UpdateExpressionOfInterestStatusInput } from '../validation/expressionOfInterestSchemas';

export async function getExpressionsOfInterest() {
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
      discovery_source,
      notes,
      status,
      created_at,
      status_updated_at
    FROM expressions_of_interest
    ORDER BY created_at DESC
  `;
}

export async function updateExpressionOfInterestStatus(id: string, data: UpdateExpressionOfInterestStatusInput) {
  const rows = await sql`
    UPDATE expressions_of_interest
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
      discovery_source,
      notes,
      status,
      created_at,
      status_updated_at
  `;

  if (!rows.length) {
    throw new NotFoundError('Expression of interest not found');
  }

  return rows[0];
}

export async function convertExpressionOfInterest(id: string, actorId: string) {
  return sql.begin(async (rawTx) => {
    const tx = asTransactionSql(rawTx);
    const expressions = await tx`
      SELECT
        id,
        youth_first_name,
        youth_last_name,
        age,
        school,
        contact_first_name,
        contact_last_name,
        contact_phone_number,
        contact_relationship,
        discovery_source,
        notes,
        status
      FROM expressions_of_interest
      WHERE id = ${id}
      FOR UPDATE
    `;

    if (!expressions.length) {
      throw new NotFoundError('Expression of interest not found');
    }

    const expression = expressions[0];
    const existingLead = await tx`
      SELECT id
      FROM leads
      WHERE expression_of_interest_id = ${id}
      LIMIT 1
    `;
    if (existingLead.length) {
      throw new ConflictError('This expression of interest has already been converted');
    }

    const leads = await tx`
      INSERT INTO leads (
        origin,
        expression_of_interest_id,
        youth_first_name,
        youth_last_name,
        age,
        school,
        contact_first_name,
        contact_last_name,
        contact_phone_number,
        contact_relationship,
        discovery_source,
        notes,
        created_by,
        updated_by
      ) VALUES (
        'expression_of_interest',
        ${expression.id},
        ${expression.youthFirstName},
        ${expression.youthLastName},
        ${expression.age},
        ${expression.school},
        ${expression.contactFirstName},
        ${expression.contactLastName},
        ${expression.contactPhoneNumber},
        ${expression.contactRelationship},
        ${expression.discoverySource},
        ${expression.notes},
        ${actorId},
        ${actorId}
      )
      RETURNING
        id,
        origin,
        expression_of_interest_id,
        youth_first_name,
        youth_last_name,
        age,
        school,
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
      UPDATE expressions_of_interest
      SET status = 'converted',
          status_updated_at = NOW(),
          updated_at = NOW(),
          updated_by = ${actorId}
      WHERE id = ${id}
    `;

    return leads[0];
  });
}
