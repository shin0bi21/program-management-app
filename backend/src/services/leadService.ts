import crypto from 'crypto';
import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import type { CreateLeadInput, LeadQuery, SignUpLeadInput, UpdateLeadInput, UpdateLeadStatusInput } from '../validation/leadSchemas';
import { applyLeadFilters } from './queryFilters/leadFilters';
import { audit } from './auditService';
import { setContacts } from './contactService';
import { cursorPage, decodeCursor } from './cursorPagination';

const leadColumns = sql`
  id,
  origin,
  expression_of_interest_id,
  converted_youth_id,
  youth_first_name,
  youth_last_name,
  age,
  school,
  program_of_interest_id,
  (SELECT name FROM programs WHERE id = program_of_interest_id) AS program_of_interest_name,
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
  const cursor = decodeCursor(filters.cursor);
  const sortValue = {
    name: sql`LOWER(youth_first_name || ' ' || youth_last_name)`,
    school: sql`LOWER(school)`,
    program: sql`LOWER(COALESCE((SELECT name FROM programs WHERE id = program_of_interest_id), ''))`,
    status: sql`status::text`,
    createdAt: sql`created_at::text`,
  }[filters.sort]!;
  const rows = await sql<Array<{ id: string; cursorValue: string }>>`
    SELECT ${leadColumns}, ${sortValue} AS cursor_value
    FROM leads
    WHERE ${where}
      AND ${cursor ? (filters.direction === 'asc'
        ? sql`(${sortValue}, id) > (${cursor.value}, ${cursor.id}::uuid)`
        : sql`(${sortValue}, id) < (${cursor.value}, ${cursor.id}::uuid)`) : sql`TRUE`}
    ORDER BY ${sortValue} ${filters.direction === 'asc' ? sql`ASC` : sql`DESC`}, id ${filters.direction === 'asc' ? sql`ASC` : sql`DESC`}
    ${filters.limit ? sql`LIMIT ${filters.limit + 1}` : sql``}
  `;
  return filters.limit ? cursorPage(rows, filters.limit) : rows.map(({ cursorValue: _cursorValue, ...row }) => row);
}

export async function createLead(data: CreateLeadInput, actorId: string) {
  const rows = await sql`
    INSERT INTO leads (
      origin,
      youth_first_name,
      youth_last_name,
      age,
      school,
      program_of_interest_id,
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
      ${data.programOfInterestId ?? null},
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
        program_of_interest_id = ${data.programOfInterestId ?? null},
        contact_phone_number = ${data.contactPhoneNumber},
        contact_relationship = ${data.contactRelationship},
        discovery_source = ${data.discoverySource},
        notes = ${data.notes ?? null},
        updated_at = NOW(),
        updated_by = ${actorId}
    WHERE id = ${id}
      AND status != 'signed_up'
      AND converted_youth_id IS NULL
    RETURNING ${leadColumns}
  `;
  if (!rows.length) {
    const existing = await sql<{ status: string; convertedYouthId: string | null }[]>`
      SELECT status, converted_youth_id
      FROM leads
      WHERE id = ${id}
      LIMIT 1
    `;
    if (!existing.length) throw new NotFoundError('Lead not found');
    throw new ConflictError('Signed-up leads must be edited through their youth profile');
  }
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

export async function signUpLead(id: string, data: SignUpLeadInput, actorId: string) {
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
      programOfInterestId: string | null;
      contactPhoneNumber: string;
      contactRelationship: string;
      notes: string | null;
      status: string;
    }[]>`
      SELECT id, expression_of_interest_id, converted_youth_id,
             youth_first_name, youth_last_name, school, program_of_interest_id,
             contact_phone_number,
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

    if (data.cohortId) {
      const cohorts = await trx<{
        id: string;
        programId: string;
        rosterMode: 'enrolled' | 'open';
      }[]>`
        SELECT pc.id, pc.program_id, p.roster_mode
        FROM program_cohorts pc
        INNER JOIN programs p ON p.id = pc.program_id
        WHERE pc.id = ${data.cohortId}
          AND CURRENT_DATE <= pc.ends_on
        FOR UPDATE OF pc
      `;
      if (!cohorts.length) throw new ConflictError('Selected cohort is unavailable');
      if (lead.programOfInterestId && cohorts[0].programId !== lead.programOfInterestId) {
        throw new ConflictError('Selected cohort does not belong to the lead program of interest');
      }
      if (cohorts[0].rosterMode === 'open') {
        throw new ConflictError('Open attendance cohorts do not use enrollment');
      }
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
      INSERT INTO youth_profiles (user_id, school_id, created_by, updated_by)
      VALUES (${youthId}, ${schoolId}, ${actorId}, ${actorId})
    `;
    await audit(trx, actorId, transactionId, 'youth_profiles', youthId, 'INSERT', null, {
      userId: youthId,
      schoolId,
    });
    if (lead.notes?.trim()) {
      await trx`
        INSERT INTO youth_profile_notes (youth_id, category, title, details, created_by, updated_by)
        VALUES (${youthId}, ${data.noteCategory}, ${lead.notes.trim()}, NULL, ${actorId}, ${actorId})
      `;
    }

    if (data.cohortId) {
      const enrollments = await trx<{ id: string; enrolledOn: string }[]>`
        INSERT INTO cohort_enrollments (
          cohort_id, youth_id, created_by, updated_by
        )
        VALUES (${data.cohortId}, ${youthId}, ${actorId}, ${actorId})
        RETURNING id, enrolled_on::text AS enrolled_on
      `;
      await audit(trx, actorId, transactionId, 'cohort_enrollments', enrollments[0].id, 'INSERT', null, {
        id: enrollments[0].id,
        cohortId: data.cohortId,
        youthId,
        enrolledOn: enrollments[0].enrolledOn,
      });
    }

    await setContacts(youthId, [{
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
