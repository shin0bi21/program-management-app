import crypto from 'crypto';
import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import type { CreateLeadInput, LeadQuery, UpdateLeadInput, UpdateLeadStatusInput } from '../validation/leadSchemas';
import { applyLeadFilters } from './queryFilters/leadFilters';
import { audit } from './auditService';
import { setContacts } from './contactService';

const leadColumns = sql`
  id,
  origin,
  expression_of_interest_id,
  converted_youth_id,
  youth_first_name,
  youth_last_name,
  age,
  school,
  program_id,
  (SELECT name FROM programs WHERE id = program_id) AS program_name,
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
      program_id,
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
      ${data.programId ?? null},
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
        program_id = ${data.programId ?? null},
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
      AND status != 'signed_up'
    RETURNING ${leadColumns}
  `;
  if (!rows.length) {
    const existing = await sql<{ status: string }[]>`SELECT status FROM leads WHERE id = ${id} LIMIT 1`;
    if (!existing.length) throw new NotFoundError('Lead not found');
    throw new ConflictError('Signed-up lead status cannot be changed');
  }
  return rows[0];
}

export async function signUpLead(id: string, actorId: string) {
  const transactionId = crypto.randomUUID();

  const convertedYouthId = await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const leads = await trx<{
      id: string;
      expressionOfInterestId: string | null;
      convertedYouthId: string | null;
      youthFirstName: string;
      youthLastName: string;
      school: string;
      programId: string | null;
      contactFirstName: string;
      contactLastName: string;
      contactPhoneNumber: string;
      contactRelationship: string;
      notes: string | null;
      status: string;
    }[]>`
      SELECT id, expression_of_interest_id, converted_youth_id,
             youth_first_name, youth_last_name, school, program_id,
             contact_first_name, contact_last_name, contact_phone_number,
             contact_relationship, notes, status
      FROM leads
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!leads.length) throw new NotFoundError('Lead not found');

    const lead = leads[0];
    if (lead.status === 'signed_up' || lead.convertedYouthId) {
      throw new ConflictError('Lead has already been signed up');
    }

    const users = await trx<{ id: string }[]>`
      INSERT INTO users (first_name, last_name, role_id, created_by, updated_by)
      VALUES (
        ${lead.youthFirstName},
        ${lead.youthLastName},
        (SELECT id FROM user_roles WHERE name = 'youth'),
        ${actorId},
        ${actorId}
      )
      RETURNING id
    `;
    const youthId = users[0].id;
    await audit(trx, actorId, transactionId, 'users', youthId, 'INSERT', null, {
      id: youthId,
      firstName: lead.youthFirstName,
      lastName: lead.youthLastName,
    });

    const schools = await trx<{ id: string }[]>`
      SELECT id FROM schools WHERE LOWER(name) = LOWER(${lead.school}) LIMIT 1
    `;
    const schoolId = schools[0]?.id ?? null;

    await trx`
      INSERT INTO youth_profiles (
        user_id, school_id, program_id, notes, status, created_by, updated_by
      ) VALUES (
        ${youthId}, ${schoolId}, ${lead.programId}, ${lead.notes}, 'active', ${actorId}, ${actorId}
      )
    `;
    await audit(trx, actorId, transactionId, 'youth_profiles', youthId, 'INSERT', null, {
      userId: youthId,
      schoolId,
      programId: lead.programId,
      notes: lead.notes,
      status: 'active',
    });

    await setContacts(youthId, [{
      firstName: lead.contactFirstName,
      lastName: lead.contactLastName,
      phoneNumber: lead.contactPhoneNumber,
      type: lead.contactRelationship,
    }], actorId, transactionId, trx);

    await trx`
      UPDATE leads
      SET status = 'signed_up',
          converted_youth_id = ${youthId},
          status_updated_at = NOW(),
          updated_at = NOW(),
          updated_by = ${actorId}
      WHERE id = ${id}
    `;
    await audit(trx, actorId, transactionId, 'leads', id, 'UPDATE',
      { status: lead.status, convertedYouthId: null },
      { status: 'signed_up', convertedYouthId: youthId });

    if (lead.expressionOfInterestId) {
      const expressions = await trx<{ id: string; status: string }[]>`
        SELECT id, status
        FROM expressions_of_interest
        WHERE id = ${lead.expressionOfInterestId}
        FOR UPDATE
      `;
      await trx`
        UPDATE expressions_of_interest
        SET status = 'signed_up', updated_at = NOW(), updated_by = ${actorId}
        WHERE id = ${lead.expressionOfInterestId}
      `;
      if (expressions[0]) {
        await audit(trx, actorId, transactionId, 'expressions_of_interest', lead.expressionOfInterestId, 'UPDATE',
          { status: expressions[0].status },
          { status: 'signed_up' });
      }
    }

    return youthId;
  });

  const rows = await sql`SELECT ${leadColumns} FROM leads WHERE id = ${id}`;
  if (!rows.length) throw new NotFoundError('Signed-up lead not found');
  return { ...rows[0], convertedYouthId };
}
