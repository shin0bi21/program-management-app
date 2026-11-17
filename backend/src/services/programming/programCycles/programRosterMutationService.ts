import { randomUUID } from 'crypto';
import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertProgramCycleAccess } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SetProgramRosterInput } from '../../../validation/programmingSchemas';
import { audit } from '../../shared/auditService';
import { getYouthRows } from '../../youth/youthRowQuery';
import { lockAssignmentCycle, lockAssignmentProgram } from './assignmentService';
import { rethrowEnrollmentConflict } from './enrollmentConflict';
import { getProgramCycleRowsByKeys } from './programCycleRowQuery';
import { getProgramRosterYouth } from './programRosterService';

interface EnrollmentRow extends Record<string, unknown> {
  id: string;
  youthId: string;
  withdrawnOn: string | null;
}

/**
 * Replaces the active roster in one transaction, retaining unchanged enrollments and attendance history.
 * @param programId - Enrollment-based program being managed.
 * @param cycleId - Assigned cycle whose complete roster is submitted.
 * @param data - Complete selected set of youth IDs; an empty set withdraws every current member.
 * @param user - User whose program scope is authorized before resource lookup.
 * @example Keeping an existing youth selected preserves their original enrollment date.
 */
export async function setProgramRoster(programId: string, cycleId: string, data: SetProgramRosterInput, user: AccessTokenPayload) {
  // 1. Authorize the assignment and keep program rules and cycle dates stable.
  await assertProgramCycleAccess(user, programId, cycleId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    await lockAssignmentProgram(trx, programId, user);
    await lockAssignmentCycle(trx, cycleId);
    const assignments = await trx`
      SELECT program_id
      FROM program_cycle_assignments
      WHERE program_id = ${programId} AND cycle_id = ${cycleId}
      FOR UPDATE
    `;
    if (!assignments.length) throw new NotFoundError('Program cycle not found');

    // 2. Validate against current eligibility, including retained members who have aged out.
    const profiles = await trx`
      SELECT user_id
      FROM youth_profiles
      WHERE user_id = ANY(${trx.array(data.youthIds)}::uuid[])
      ORDER BY user_id
      FOR SHARE
    `;
    if (profiles.length !== data.youthIds.length) throw new NotFoundError('One or more youth profiles were not found');
    const available = await getProgramRosterYouth(programId, cycleId, user, trx);
    const availableIds = new Set(available.map(profile => profile.id));
    if (data.youthIds.some(id => !availableIds.has(id))) {
      throw new ConflictError('One or more selected youth are no longer eligible for this roster');
    }
    const previous = await trx<EnrollmentRow[]>`
      SELECT *
      FROM program_enrollments
      WHERE program_id = ${programId} AND cycle_id = ${cycleId}
      ORDER BY youth_id
      FOR UPDATE
    `;
    const previousByYouth = new Map(previous.map(enrollment => [enrollment.youthId, enrollment]));
    const selectedIds = new Set(data.youthIds);
    const addedIds = data.youthIds.filter(id => {
      const enrollment = previousByYouth.get(id);
      return !enrollment || enrollment.withdrawnOn !== null;
    }).sort();
    const removedIds = previous.filter(enrollment => enrollment.withdrawnOn === null && !selectedIds.has(enrollment.youthId))
      .map(enrollment => enrollment.youthId);

    // 3. Apply only membership differences, keeping retained dates and attendance untouched.
    const withdrawn = await trx<EnrollmentRow[]>`
      UPDATE program_enrollments
      SET withdrawn_on = CURRENT_DATE,
          updated_at = NOW(), updated_by = ${user.userId}
      WHERE program_id = ${programId} AND cycle_id = ${cycleId}
        AND youth_id = ANY(${trx.array(removedIds)}::uuid[])
      RETURNING *
    `;
    const enrolled = await trx<EnrollmentRow[]>`
      INSERT INTO program_enrollments (program_id, cycle_id, youth_id, created_by, updated_by)
      SELECT ${programId}, ${cycleId}, selected.youth_id, ${user.userId}, ${user.userId}
      FROM UNNEST(${trx.array(addedIds)}::uuid[]) AS selected(youth_id)
      ORDER BY selected.youth_id
      ON CONFLICT (program_id, cycle_id, youth_id) DO UPDATE SET
        withdrawn_on = NULL,
        enrolled_on = EXCLUDED.enrolled_on,
        updated_at = NOW(), updated_by = EXCLUDED.updated_by
      RETURNING *
    `;
    const transactionId = randomUUID();
    for (const enrollment of [...withdrawn, ...enrolled]) {
      const old = previousByYouth.get(enrollment.youthId);
      await audit(trx, user.userId, transactionId, 'program_enrollments', enrollment.id, old ? 'UPDATE' : 'INSERT', old ?? null, enrollment);
    }

    // 4. Return the canonical assignment and only affected youth the user may read.
    const [programCycle] = await getProgramCycleRowsByKeys(trx, user, [{ programId, cycleId }]);
    const changedIds = [...removedIds, ...addedIds];
    return {
      programCycle,
      updatedYouth: user.permissions.includes('read:youth_profiles')
        ? await getYouthRows(trx`youth.id = ANY(${trx.array(changedIds)}::uuid[])`, trx) : [],
    };
  }).catch(rethrowEnrollmentConflict);
}
