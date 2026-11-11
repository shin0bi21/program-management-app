import crypto from 'crypto';
import type { AccessTokenPayload } from '../../../types/auth';
import { getProgramCycleRowsByKeys } from '../../programming/programCycles/programCycleRowQuery';
import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import type { CreateLeadInput, SignUpLeadInput, UpdateLeadInput, UpdateLeadStatusInput } from '../../../validation/leadSchemas';
import { audit } from '../../shared/auditService';
import { setContacts } from '../../youth/youthContactService';
import { leadRowColumns } from './leadRowQuery';

/**
 * Loads one canonical lead, including its current age and recommended program.
 * @param id - Lead ID; a missing record throws 404.
 * @example await getLead(id) // complete intake row
 */
export async function getLead(id: string) {
  // 1. Load the lead.
  const rows = await sql`
    SELECT ${leadRowColumns}
    FROM leads
    WHERE id = ${id}
  `;
  if (!rows.length) throw new NotFoundError('Lead not found');
  return rows[0];
}

/**
 * Creates one internal staff-submitted lead and returns its canonical intake row.
 * @param data - Validated intake fields; optional notes are stored as null when omitted.
 * @param actorId - Staff user recorded as the creator and last editor.
 * @example await createLead(data, actorId) // saved lead with age and recommended program
 */
export async function createLead(data: CreateLeadInput, actorId: string) {
  // 1. Store the internal intake and return its canonical projection.
  const rows = await sql`
    INSERT INTO leads (
      origin,
      submitted_by_role,
      youth_first_name,
      youth_last_name,
      date_of_birth,
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
      ${data.dateOfBirth},
      ${data.school},
      ${data.contactPhoneNumber},
      ${data.contactRelationship},
      ${data.discoverySource},
      ${data.notes ?? null},
      ${actorId},
      ${actorId}
    )
    RETURNING ${leadRowColumns}
  `;
  return rows[0];
}

/**
 * Creates an external intake lead inside the caller's transaction.
 * @param data - Validated intake fields supplied by the public form.
 * @param submittedByRole - Public submitter's relationship to the youth.
 * @param trx - Existing transaction owning the public intake workflow.
 * @example await createExternalLead(data, 'parent', trx) // saved external lead
 */
export async function createExternalLead(
  data: CreateLeadInput,
  submittedByRole: 'youth' | 'parent' | 'guardian',
  trx: typeof sql,
) {
  // 1. Store the external intake inside the existing transaction.
  const rows = await trx`
    INSERT INTO leads (
      origin,
      submitted_by_role,
      youth_first_name,
      youth_last_name,
      date_of_birth,
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
      ${data.dateOfBirth},
      ${data.school},
      ${data.contactPhoneNumber},
      ${data.contactRelationship},
      ${data.discoverySource},
      ${data.notes ?? null}
    )
    RETURNING ${leadRowColumns}
  `;
  return rows[0];
}

/**
 * Updates editable intake details and returns the canonical saved lead.
 * @param id - Existing lead ID; missing leads are 404 and converted leads are 409.
 * @param data - Validated replacement intake fields.
 * @param actorId - Staff user recorded as the last editor.
 * @example await updateLead(id, data, actorId) // current age and recommended program included
 */
export async function updateLead(id: string, data: UpdateLeadInput, actorId: string) {
  // 1. Replace intake fields only while the lead remains unconverted.
  const rows = await sql`
    UPDATE leads
    SET youth_first_name = ${data.youthFirstName},
        youth_last_name = ${data.youthLastName},
        date_of_birth = ${data.dateOfBirth},
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
    RETURNING ${leadRowColumns}
  `;

  // 2. Distinguish missing records from converted, read-only intake.
  if (!rows.length) {
    const existing = await sql<{ status: string; convertedYouthId: string | null }[]>`
      SELECT
        status,
        converted_youth_id
      FROM leads
      WHERE id = ${id}
      LIMIT 1
    `;
    if (!existing.length) throw new NotFoundError('Lead not found');
    throw new ConflictError('Signed-up leads must be edited through their youth profile');
  }
  return rows[0];
}

/**
 * Updates an unconverted lead's status and audits the change in one transaction.
 * @param id - Lead ID; missing records are 404 and converted records are 409.
 * @param data - Validated destination status.
 * @param actorId - Staff user recorded on the update and audit.
 * @example await updateLeadStatus(id, data, actorId) // canonical saved lead
 */
export async function updateLeadStatus(id: string, data: UpdateLeadStatusInput, actorId: string) {
  // 1. Assign one audit transaction to the status change.
  const transactionId = crypto.randomUUID();

  await sql.begin(async rawTx => {
    const trx = asTransactionSql(rawTx);

    // 2. Lock the intake row before checking its conversion state.
    const leads = await trx<Record<string, unknown>[]>`
      SELECT ${leadRowColumns}
      FROM leads
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!leads.length) throw new NotFoundError('Lead not found');

    const lead = leads[0] as { status: string; convertedYouthId: string | null } & Record<string, unknown>;

    // 3. Reject status changes after conversion.
    if (lead.status === 'signed_up' || lead.convertedYouthId) {
      throw new ConflictError('Signed-up lead status cannot be changed');
    }

    // 4. Save the requested status and retain its timestamp when unchanged.
    const updatedLeads = await trx<Record<string, unknown>[]>`
      UPDATE leads
      SET status = ${data.status},
          status_updated_at = CASE
            WHEN status = ${data.status} THEN status_updated_at
            ELSE NOW()
          END,
          updated_at = NOW(),
          updated_by = ${actorId}
      WHERE id = ${id}
      RETURNING ${leadRowColumns}
    `;

    // 5. Audit the status transition in the same transaction.
    await audit(trx, actorId, transactionId, 'leads', id, 'UPDATE', lead, updatedLeads[0]);
  });

  // 6. Return the canonical saved intake.
  return getLead(id);
}

/**
 * Converts an unconverted intake into a youth profile and optional program enrollment atomically.
 * @param id - Lead ID, locked until conversion completes; missing leads are 404 and invalid states are 409.
 * @param data - Validated birthdate override, optional program/cycle, and note category.
 * @param actor - Staff actor for audit ownership and permission-gated assignment response data.
 * @returns The converted lead and, when readable, its updated program-cycle row.
 * @example await signUpLead(id, data, actor) // { lead, updatedProgramCycle? }
 */
export async function signUpLead(id: string, data: SignUpLeadInput, actor: AccessTokenPayload) {
  // 1. Start the lead signup.
  const actorId = actor.userId;
  const transactionId = crypto.randomUUID();

  return sql.begin(async rawTx => {
    const trx = asTransactionSql(rawTx);

    // 2. Find and lock the lead.
    const leads = await trx<{
      id: string;
      youthFirstName: string;
      youthLastName: string;
      school: string;
      contactPhoneNumber: string;
      contactRelationship: string;
      notes: string | null;
      status: string;
      convertedYouthId: string | null;
      dateOfBirth: string | null;
    }[]>`
      SELECT
        id,
        youth_first_name,
        youth_last_name,
        school,
        contact_phone_number,
        contact_relationship,
        notes,
        status,
        converted_youth_id,
        date_of_birth
      FROM leads
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!leads.length) throw new NotFoundError('Lead not found');

    const lead = leads[0];

    // 3. Require an unconverted lead and an available birthdate.
    if (lead.status === 'signed_up' || lead.convertedYouthId) {
      throw new ConflictError('Lead has already been signed up');
    }
    const dateOfBirth = data.dateOfBirth ?? lead.dateOfBirth;
    if (!dateOfBirth) {
      throw new ConflictError('Date of birth is required before signing up this lead');
    }

    // 4. Lock and validate the optional destination enrollment.
    if (data.programId && data.cycleId) {
      // Lead conversion may enroll in an eligible program outside the actor’s assigned programs.
      await trx`
        SELECT id
        FROM programs
        WHERE id = ${data.programId}
        FOR UPDATE
      `;

      const [programCycle] = await trx<{
        enrollmentRequired: boolean;
        minAge: number | null;
        maxAge: number | null;
        age: number;
      }[]>`
        SELECT
          p.enrollment_required,
          p.min_age,
          p.max_age,

          EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${dateOfBirth}::date))::int AS age
        FROM program_cycle_assignments pc
        INNER JOIN program_cycles cycle ON cycle.id = pc.cycle_id
        INNER JOIN programs p ON p.id = pc.program_id
        WHERE pc.program_id = ${data.programId} AND pc.cycle_id = ${data.cycleId}
          AND CURRENT_DATE <= cycle.ends_on
        FOR UPDATE OF pc
      `;
      if (!programCycle) throw new ConflictError('Selected program cycle is unavailable');
      if (!programCycle.enrollmentRequired) {
        throw new ConflictError('Open attendance programs do not use enrollment');
      }
      const outsideAgeRange = (programCycle.minAge !== null && programCycle.age < programCycle.minAge)
        || (programCycle.maxAge !== null && programCycle.age > programCycle.maxAge);
      if (outsideAgeRange) {
        throw new ConflictError('Lead does not meet this program age range');
      }
    }

    // 5. Create the youth identity.
    const users = await trx<{ id: string }[]>`
      INSERT INTO users (first_name, last_name, role_id, created_by, updated_by)
      VALUES (
        ${lead.youthFirstName},
        ${lead.youthLastName},
        (
          SELECT id
          FROM user_roles
          WHERE name = 'youth'
        ),
        ${actorId},
        ${actorId}
      )
      RETURNING id
    `;
    const youthId = users[0].id;

    // 6. Record the new youth account.
    await audit(trx, actorId, transactionId, 'users', youthId, 'INSERT', null, {
      id: youthId,
      firstName: lead.youthFirstName,
      lastName: lead.youthLastName,
    });

    // 7. Resolve a matching school without creating a new lookup.
    const schools = await trx<{ id: string }[]>`
      SELECT id
      FROM schools
      WHERE LOWER(name) = LOWER(${lead.school})
      LIMIT 1
    `;
    const schoolId = schools[0]?.id ?? null;

    // 8. Create and audit the youth profile.
    await trx`
      INSERT INTO youth_profiles (user_id, date_of_birth, school_id, created_by, updated_by)
      VALUES (${youthId}, ${dateOfBirth}, ${schoolId}, ${actorId}, ${actorId})
    `;
    await audit(trx, actorId, transactionId, 'youth_profiles', youthId, 'INSERT', null, {
      userId: youthId,
      dateOfBirth,
      schoolId,
    });

    // 9. Preserve intake notes on the youth profile.
    if (lead.notes?.trim()) {
      await trx`
        INSERT INTO youth_profile_notes (youth_id, category, details, created_by, updated_by)
        VALUES (${youthId}, ${data.noteCategory}, ${lead.notes.trim()}, ${actorId}, ${actorId})
      `;
    }

    // 10. Create and audit the optional program enrollment.
    if (data.programId && data.cycleId) {
      const enrollments = await trx<{ id: string; enrolledOn: string }[]>`
        INSERT INTO program_enrollments (
          program_id, cycle_id, youth_id, created_by, updated_by
        )
        VALUES (${data.programId}, ${data.cycleId}, ${youthId}, ${actorId}, ${actorId})
        RETURNING
          id,
          enrolled_on
      `;
      await audit(trx, actorId, transactionId, 'program_enrollments', enrollments[0].id, 'INSERT', null, {
        id: enrollments[0].id,
        programId: data.programId,
        cycleId: data.cycleId,
        youthId,
        enrolledOn: enrollments[0].enrolledOn,
      });
    }

    // 11. Save the lead contact.
    await setContacts(youthId, [{
      phoneNumber: lead.contactPhoneNumber,
      type: lead.contactRelationship,
    }], actorId, transactionId, trx);

    // 12. Mark the intake converted and audit its new youth link.
    await trx`
      UPDATE leads
      SET status = 'signed_up',
          date_of_birth = ${dateOfBirth},
          converted_youth_id = ${youthId},
          status_updated_at = NOW(),
          updated_at = NOW(),
          updated_by = ${actorId}
      WHERE id = ${id}
    `;
    await audit(trx, actorId, transactionId, 'leads', id, 'UPDATE',
      { status: lead.status, convertedYouthId: null, dateOfBirth: lead.dateOfBirth },
      { dateOfBirth, status: 'signed_up', convertedYouthId: youthId });

    // 13. Return the lead and affected rows.
    const [leadRecord] = await trx`
      SELECT ${leadRowColumns}
      FROM leads
      WHERE id = ${id}
    `;
    const [updatedProgramCycle] = data.programId && data.cycleId && actor.permissions.includes('read:programs')
      ? await getProgramCycleRowsByKeys(trx, actor, [{ programId: data.programId, cycleId: data.cycleId }])
      : [];
    return { lead: leadRecord, ...(updatedProgramCycle ? { updatedProgramCycle } : {}) };
  });
}

/**
 * Deletes an unconverted lead and audits its previous row in one transaction.
 * @param id - Lead ID; missing records are 404 and converted records are 409.
 * @param actorId - Staff user recorded as the audit actor.
 * @example await deleteLead(id, actorId) // { id }
 */
export async function deleteLead(id: string, actorId: string) {
  // 1. Assign one audit transaction to the deletion.
  const transactionId = crypto.randomUUID();

  return sql.begin(async rawTx => {
    const trx = asTransactionSql(rawTx);

    // 2. Lock the intake before checking deletion eligibility.
    const rows = await trx<Record<string, unknown>[]>`
      SELECT ${leadRowColumns}
      FROM leads
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!rows.length) throw new NotFoundError('Lead not found');
    const lead = rows[0] as { status: string; convertedYouthId: string | null } & Record<string, unknown>;

    // 3. Preserve converted intake history.
    if (lead.status === 'signed_up' || lead.convertedYouthId) {
      throw new ConflictError('Signed-up leads cannot be deleted');
    }

    // 4. Delete and audit the unconverted intake atomically.
    await trx`
      DELETE
      FROM leads
      WHERE id = ${id}
    `;
    await audit(trx, actorId, transactionId, 'leads', id, 'DELETE', lead, null);
    return { id };
  });
}
