import { sql } from '../db/client';
import { NotFoundError } from '../errors';
import type { CreateLeadInput, LeadQuery, UpdateLeadInput, UpdateLeadStatusInput } from '../validation/leadSchemas';
import { applyLeadFilters } from './queryFilters/leadFilters';

const leadColumns = sql`
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

export async function getLeads(filters: LeadQuery) {
  const where = applyLeadFilters(filters);
  return sql`
    SELECT ${leadColumns}
    FROM leads
    WHERE ${where}
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

export async function updateLead(id: string, data: UpdateLeadInput, actorId: string) {
  const rows = await sql`
    UPDATE leads
    SET youth_first_name = ${data.youthFirstName},
        youth_last_name = ${data.youthLastName},
        age = ${data.age},
        school = ${data.school},
        contact_first_name = ${data.contactFirstName},
        contact_last_name = ${data.contactLastName},
        contact_phone_number = ${data.contactPhoneNumber},
        contact_relationship = ${data.contactRelationship},
        discovery_source = ${data.discoverySource},
        notes = ${data.notes ?? null},
        updated_at = NOW(),
        updated_by = ${actorId}
    WHERE id = ${id}
    RETURNING ${leadColumns}
  `;
  if (!rows.length) throw new NotFoundError('Lead not found');
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
