import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertProgramCycleAccess } from '../../../policies/programAccessPolicy';
import { lockAssignmentCycle, lockAssignmentProgram } from './assignmentService';
import { rethrowEnrollmentConflict } from './enrollmentConflict';
import type { AccessTokenPayload } from '../../../types/auth';
import type { EnrollYouthInput } from '../../../validation/programmingSchemas';
import { getProgramCycleRowsByKeys } from './programCycleRowQuery';
import { getYouthRows } from '../../youth/youthRowQuery';

/**
 * Enrolls the selected youth in one program at a time and returns affected rows.
 * Conflicting enrollment periods reject the entire batch.
 * @param programId - Enrollment program.
 * @param cycleId - Assigned cycle.
 * @param data - Validated youth IDs.
 * @param user - User whose program access is checked.
 * @example enrollYouth(programId, cycleId, data, user)
 */
export async function enrollYouth(programId: string, cycleId: string, data: EnrollYouthInput, user: AccessTokenPayload) {
  // 1. Check access to the program cycle.
  await assertProgramCycleAccess(user, programId, cycleId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Lock and check the program assignment.
    await lockAssignmentProgram(trx, programId, user);

    await lockAssignmentCycle(trx, cycleId);

    const [programCycle] = await trx<{
      programId: string;
      enrollmentRequired: boolean;
      minAge: number | null;
      maxAge: number | null;
    }[]>`
      SELECT
        assignment.program_id,

        program.enrollment_required,
        program.min_age,
        program.max_age
      FROM program_cycle_assignments assignment
      INNER JOIN programs program ON program.id = assignment.program_id
      WHERE assignment.program_id = ${programId} AND assignment.cycle_id = ${cycleId}
      FOR UPDATE OF assignment
    `;
    if (!programCycle) throw new NotFoundError('Program cycle not found');
    if (!programCycle.enrollmentRequired) {
      throw new ConflictError('Open attendance programs do not use enrollment');
    }

    // 3. Check the selected youth and age requirements.
    const age = sql`EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))::int`;
    const youth = await trx<{ id: string; age: number | null }[]>`
      SELECT
        user_id AS id,

        ${age} AS age
      FROM youth_profiles
      WHERE user_id = ANY(${sql.array(data.youthIds)}::uuid[])
      ORDER BY user_id
      FOR SHARE
    `;
    if (youth.length !== data.youthIds.length) {
      throw new NotFoundError('One or more youth profiles were not found');
    }

    const outsideAgeRange = youth.some(({ age: youthAge }) => (
      (programCycle.minAge !== null && (youthAge === null || youthAge < programCycle.minAge))
      || (programCycle.maxAge !== null && (youthAge === null || youthAge > programCycle.maxAge))
    ));
    if (outsideAgeRange) {
      throw new ConflictError('One or more youth profiles do not meet this program age range');
    }

    // 4. Save the enrollments.
    const enrollments = await trx`
      INSERT INTO program_enrollments (
        program_id, cycle_id, youth_id, created_by, updated_by
      )
      SELECT
        ${programId},
        ${cycleId},
        selected.youth_id,
        ${user.userId},
        ${user.userId}
      FROM UNNEST(${sql.array(data.youthIds)}::uuid[]) AS selected(youth_id)
      ORDER BY selected.youth_id
      ON CONFLICT (program_id, cycle_id, youth_id) DO UPDATE SET
        withdrawn_on = NULL,
        enrolled_on = EXCLUDED.enrolled_on,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING
        id,
        youth_id,
        enrolled_on,
        withdrawn_on,
        created_at,
        updated_at,
        program_id,
        cycle_id
    `;

    // 5. Return the affected rows.
    const [updatedProgramCycle] = await getProgramCycleRowsByKeys(trx, user, [{ programId, cycleId }]);
    return {
      enrollments,
      programCycle: updatedProgramCycle,
      updatedYouth: user.permissions.includes('read:youth_profiles')
        ? await getYouthRows(trx`youth.id = ANY(${trx.array(data.youthIds)}::uuid[])`, trx) : [],
    };
  }).catch(rethrowEnrollmentConflict);
}

/**
 * Withdraws an enrolled youth and returns affected rows.
 * @param programId - Enrollment program.
 * @param cycleId - Assigned cycle.
 * @param youthId - Youth with an active enrollment.
 * @param user - User whose program access is checked.
 * @example withdrawYouth(programId, cycleId, youthId, user)
 */
export async function withdrawYouth(
  programId: string, cycleId: string,
  youthId: string,
  user: AccessTokenPayload,
) {
  // 1. Check access to the program cycle.
  await assertProgramCycleAccess(user, programId, cycleId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Lock the program assignment.
    await lockAssignmentProgram(trx, programId, user);
    await lockAssignmentCycle(trx, cycleId);
    await trx`
      SELECT program_id
      FROM program_cycle_assignments
      WHERE program_id = ${programId} AND cycle_id = ${cycleId}
      FOR UPDATE
    `;

    // 3. Withdraw the active enrollment.
    const [enrollment] = await trx`
      UPDATE program_enrollments
      SET withdrawn_on = CURRENT_DATE,
          updated_at = NOW(), updated_by = ${user.userId}
      WHERE program_id = ${programId} AND cycle_id = ${cycleId} AND youth_id = ${youthId} AND withdrawn_on IS NULL
      RETURNING
        id,
        youth_id,
        enrolled_on,
        withdrawn_on,
        created_at,
        updated_at,
        program_id,
        cycle_id
    `;
    if (!enrollment) throw new NotFoundError('Active program enrollment not found');

    // 4. Return the affected rows.
    const [programCycle] = await getProgramCycleRowsByKeys(trx, user, [{ programId, cycleId }]);
    return {
      enrollment,
      programCycle,
      updatedYouth: user.permissions.includes('read:youth_profiles')
        ? await getYouthRows(trx`youth.id = ${youthId}`, trx) : [],
    };
  }).catch(rethrowEnrollmentConflict);
}
