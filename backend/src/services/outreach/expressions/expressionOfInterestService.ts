import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, InternalServerError, NotFoundError } from '../../../errors';
import type { ExpressionOfInterestQuery, UpdateExpressionOfInterestStatusInput } from '../../../validation/expressionOfInterestSchemas';
import { suggestProgramNameForAge } from '../../programService';
import { cursorPage, decodeCursor } from '../../shared/cursorPagination';

export async function getExpressionsOfInterest(filters: ExpressionOfInterestQuery) {
  const where = applyExpressionOfInterestFilters(filters);
  const cursor = decodeCursor(filters.cursor);
  const suggestedProgram = sql`CASE WHEN e.age BETWEEN 12 AND 15 THEN 'Soft Skills' WHEN e.age BETWEEN 16 AND 19 THEN 'Job Readiness' ELSE '' END`;
  const sortValue = {
    name: sql`LOWER(e.youth_first_name || ' ' || e.youth_last_name)`,
    age: sql`LPAD(e.age::text, 4, '0')`,
    school: sql`LOWER(e.school)`,
    program: sql`LOWER(${suggestedProgram})`,
    submittedByRole: sql`e.submitted_by_role::text`,
    createdAt: sql`e.created_at::text`,
    status: sql`e.status::text`,
  }[filters.sort]!;
  const rows = await sql<Array<{ id: string; cursorValue: string }>>`
    SELECT
      e.id,
      e.youth_first_name,
      e.youth_last_name,
      e.contact_phone_number,
      e.contact_relationship,
      e.age,
      e.school,
      e.submitted_by_role,
      e.discovery_source,
      e.notes,
      e.status,
      e.created_at,
      e.status_updated_at,
      p.id AS suggested_program_id,
      p.name AS suggested_program_name,
      ${sortValue} AS cursor_value
    FROM expressions_of_interest e
    LEFT JOIN programs p ON p.name = CASE
      WHEN e.age BETWEEN 12 AND 15 THEN 'Soft Skills'
      WHEN e.age BETWEEN 16 AND 19 THEN 'Job Readiness'
      ELSE NULL
    END
    WHERE ${where}
      AND ${cursor ? (filters.direction === 'asc'
        ? sql`(${sortValue}, e.id) > (${cursor.value}, ${cursor.id}::uuid)`
        : sql`(${sortValue}, e.id) < (${cursor.value}, ${cursor.id}::uuid)`) : sql`TRUE`}
    ORDER BY ${sortValue} ${filters.direction === 'asc' ? sql`ASC` : sql`DESC`}, e.id ${filters.direction === 'asc' ? sql`ASC` : sql`DESC`}
    ${filters.limit ? sql`LIMIT ${filters.limit + 1}` : sql``}
  `;
  return filters.limit ? cursorPage(rows, filters.limit) : rows.map(({ cursorValue: _cursorValue, ...row }) => row);
}

export async function updateExpressionOfInterestStatus(id: string, data: UpdateExpressionOfInterestStatusInput) {
  return sql.begin(async rawTx => {
    const tx = asTransactionSql(rawTx);
    const expressions = await tx<{ id: string; status: string; converted: boolean }[]>`
      SELECT e.id, e.status, EXISTS (
        SELECT 1 FROM leads lead WHERE lead.expression_of_interest_id = e.id
      ) AS converted
      FROM expressions_of_interest e
      WHERE e.id = ${id}
      FOR UPDATE
    `;
    if (!expressions.length) throw new NotFoundError('Expression of interest not found');
    if (expressions[0].converted && data.status !== expressions[0].status) {
      throw new ConflictError('Converted expressions of interest cannot be changed');
    }
    if (!expressions[0].converted && data.status === 'converted') {
      throw new ConflictError('Use Convert to Lead to mark an expression of interest as converted');
    }

    const rows = await tx`
      UPDATE expressions_of_interest
      SET status = ${data.status}, status_updated_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, youth_first_name, youth_last_name, contact_phone_number,
        contact_relationship, age, school, submitted_by_role, discovery_source,
        notes, status, created_at, status_updated_at
    `;
    return rows[0];
  });
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
    const suggestedProgramName = suggestProgramNameForAge(expression.age);
    if (!suggestedProgramName) {
      throw new ConflictError('Expression age must be between 12 and 19 before conversion');
    }
    const programs = await tx<{ id: string }[]>`
      SELECT id FROM programs WHERE name = ${suggestedProgramName} LIMIT 1
    `;
    if (!programs.length) {
      throw new InternalServerError(`Expected program ${suggestedProgramName} to exist.`);
    }
    const programOfInterestId = programs[0].id;
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
        program_of_interest_id,
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
        ${programOfInterestId},
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

function applyExpressionOfInterestFilters(filters: ExpressionOfInterestQuery) {
  const statusFilter = filters.statuses.length
    ? sql`e.status = ANY(${sql.array(filters.statuses)}::text[])`
    : sql`TRUE`;
  const programFilter = filters.programIds.length
    ? sql`p.id = ANY(${sql.array(filters.programIds)}::uuid[])`
    : sql`TRUE`;
  const searchFilter = filters.search
    ? sql`CONCAT_WS(' ', e.youth_first_name, e.youth_last_name, e.school, p.name) ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'`
    : sql`TRUE`;

  return sql`${statusFilter} AND ${programFilter} AND ${searchFilter}`;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}
