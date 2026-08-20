import crypto from 'crypto';
import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import type { CreateLeadInput, LeadQuery, SignUpLeadInput, UpdateLeadInput, UpdateLeadStatusInput } from '../../../validation/leadSchemas';
import { audit } from '../../shared/auditService';
import { setContacts } from '../../youth/youthContactService';
import { cursorPage, decodeCursor } from '../../shared/cursorPagination';

const leadColumns = sql`
  id,
  origin,
  submitted_by_role,
  converted_youth_id,
  youth_first_name,
  youth_last_name,
  age,
  school,
  (SELECT id FROM programs WHERE name = CASE
    WHEN age BETWEEN 12 AND 15 THEN 'Soft Skills'
    WHEN age BETWEEN 16 AND 19 THEN 'Job Readiness'
    ELSE NULL
  END LIMIT 1) AS recommended_program_id,
  CASE
    WHEN age BETWEEN 12 AND 15 THEN 'Soft Skills'
    WHEN age BETWEEN 16 AND 19 THEN 'Job Readiness'
    ELSE NULL
  END AS recommended_program_name,
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
    program: sql`LOWER(CASE WHEN age BETWEEN 12 AND 15 THEN 'Soft Skills' WHEN age BETWEEN 16 AND 19 THEN 'Job Readiness' ELSE '' END)`,
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
      submitted_by_role,
      youth_first_name,
      youth_last_name,
      age,
      school,
      contact_phone_number,
      contact_relationship,
      discovery_source,
      notes,
      created_by,
      updated_by
    ) VALUES (
      'internal',
      'staff',
      ${data.youthFirstName},
      ${data.youthLastName},
      ${data.age},
      ${data.school},
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

export async function createExternalLead(data: CreateLeadInput, submittedByRole: 'youth' | 'parent' | 'guardian') {
  const rows = await sql`
    INSERT INTO leads (
      origin,
      submitted_by_role,
      youth_first_name,
      youth_last_name,
      age,
      school,
      contact_phone_number,
      contact_relationship,
      discovery_source,
      notes
    ) VALUES (
      'external',
      ${submittedByRole},
      ${data.youthFirstName},
      ${data.youthLastName},
      ${data.age},
      ${data.school},
      ${data.contactPhoneNumber},
      ${data.contactRelationship},
      ${data.discoverySource},
      ${data.notes ?? null}
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

export async function deleteLead(id: string, actorId: string) {
  const transactionId = crypto.randomUUID();
  return sql.begin(async rawTx => {
    const tx = asTransactionSql(rawTx);
    const rows = await tx<Record<string, unknown>[]>`
      SELECT ${leadColumns} FROM leads
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!rows.length) throw new NotFoundError('Lead not found');
    const lead = rows[0] as { status: string; convertedYouthId: string | null } & Record<string, unknown>;
    if (lead.status === 'signed_up' || lead.convertedYouthId) {
      throw new ConflictError('Signed-up leads cannot be deleted');
    }
    await tx`DELETE FROM leads WHERE id = ${id}`;
    await audit(tx, actorId, transactionId, 'leads', id, 'DELETE', lead, null);
    return { id };
  });
}

export async function signUpLead(id: string, data: SignUpLeadInput, actorId: string) {
  const transactionId = crypto.randomUUID();

  const convertedYouthId = await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const leads = await trx<{
      id: string;
      convertedYouthId: string | null;
      youthFirstName: string;
      youthLastName: string;
      school: string;
      contactPhoneNumber: string;
      contactRelationship: string;
      notes: string | null;
      status: string;
    }[]>`
      SELECT id, converted_youth_id,
             youth_first_name, youth_last_name, school,
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
        INNER JOIN program_cycles cycle ON cycle.id = pc.cycle_id
        INNER JOIN programs p ON p.id = pc.program_id
        WHERE pc.id = ${data.cohortId}
          AND CURRENT_DATE <= cycle.ends_on
        FOR UPDATE OF pc
      `;
      if (!cohorts.length) throw new ConflictError('Selected cohort is unavailable');
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

    return youthId;
  });

  const rows = await sql`SELECT ${leadColumns} FROM leads WHERE id = ${id}`;
  if (!rows.length) throw new NotFoundError('Signed-up lead not found');
  return { ...rows[0], convertedYouthId };
}

function applyLeadFilters(filters: LeadQuery) {
  const statusFilter = filters.statuses.length
    ? sql`status = ANY(${sql.array(filters.statuses)}::lead_status[])`
    : sql`TRUE`;
  const searchFilter = filters.search
    ? sql`CONCAT_WS(' ', youth_first_name, youth_last_name, school) ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'`
    : sql`TRUE`;
  const programFilter = filters.programIds.length
    ? sql`(SELECT id FROM programs WHERE name = CASE WHEN age BETWEEN 12 AND 15 THEN 'Soft Skills' WHEN age BETWEEN 16 AND 19 THEN 'Job Readiness' ELSE NULL END LIMIT 1) = ANY(${sql.array(filters.programIds)}::uuid[])`
    : sql`TRUE`;
  const originFilter = filters.origins.length
    ? sql`origin = ANY(${sql.array(filters.origins)}::lead_origin[])`
    : sql`TRUE`;
  return sql`${statusFilter} AND ${programFilter} AND ${originFilter} AND ${searchFilter}`;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}
