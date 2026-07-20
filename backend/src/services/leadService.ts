import { sql } from '../db/client';
import { NotFoundError } from '../errors';
import type { CreateLeadInput, UpdateLeadStatusInput } from '../validation/leadSchemas';

const leadColumns = sql`
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

export async function getLeads() {
  return sql`
    SELECT ${leadColumns}
    FROM leads
    ORDER BY created_at DESC
  `;
}

export async function createLead(data: CreateLeadInput, actorId: string) {
  const rows = await sql`
    INSERT INTO leads (
      origin,
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
      'staff_created',
      ${data.youthFirstName},
      ${data.youthLastName},
      ${data.age},
      ${data.school},
      ${data.responseEmail ?? null},
      ${data.responsePhoneNumber ?? data.contactPhoneNumber},
      ${data.contactFirstName},
      ${data.contactLastName},
      ${data.contactPhoneNumber},
      ${data.contactRelationship},
      ${data.discoverySource},
      ${data.notes ?? null},
      ${actorId},
      ${actorId}
    )
    RETURNING ${leadColumns}
  `;
  return rows[0];
}

export async function updateLeadStatus(id: string, data: UpdateLeadStatusInput, actorId: string) {
  const rows = await sql`
    UPDATE leads
    SET status = ${data.status},
        status_updated_at = NOW(),
        updated_at = NOW(),
        updated_by = ${actorId}
    WHERE id = ${id}
    RETURNING ${leadColumns}
  `;
  if (!rows.length) throw new NotFoundError('Lead not found');
  return rows[0];
}
