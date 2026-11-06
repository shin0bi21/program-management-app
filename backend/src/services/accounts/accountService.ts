import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { audit } from '../shared/auditService';
import { sql, asTransactionSql } from '../../db/client';
import type { Users, UserCredentials } from '../../types/database';
import type { DbRow } from '../../types/db';
import type { AccessTokenPayload, UserRole } from '../../types/auth';
import type { SetAccountInput } from '../../validation/accountSchemas';
import { sendStaffInvite, sendYouthInvite, sendInviteEmailChanged, sendEmailChangedOldAddress, sendEmailChangedNewAddress } from '../../utils/emailService';
import { ConflictError, NotFoundError, InternalServerError, isUniqueViolation } from '../../errors';
import { assertCanCreateAccount, assertCanManageAccount } from '../../policies/accountPolicy';
import { accountRecordColumns, accountRecordFrom, type AccountRow } from './accountRecordQuery';
import { requireEnv } from '../../utils/env';

const FRONTEND_URL = requireEnv('FRONTEND_URL');
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates an invited employee account or updates one after checking actor authority.
 * Required emails are awaited after commit, so delivery failures do not roll back the account.
 * @param data - Validated employee fields; omitted role defaults to staff. Omitted programIds preserves
 * existing assignments on update; an empty list clears them.
 * @param actor - Actor whose role permissions are checked and whose ID is audited.
 * @returns The complete account row, including its role, status, and ordered program IDs.
 * @example setAccount({ firstName: 'Alex', lastName: 'Lee', email: 'alex@example.org' }, admin) // invited staff account
 */
export async function setAccount(data: SetAccountInput, actor: AccessTokenPayload) {
  // 1. Check authority over the current account and requested role.
  const { id, firstName, lastName, email, role = 'staff', programIds } = data;
  if (id) {
    assertCanManageAccount(actor, await getAccountRole(id));
  }
  assertCanCreateAccount(actor, role);
  const transactionId = crypto.randomUUID();
  const actorId = actor.userId;

  // 2. Resolve the requested role.
  const roles = await sql<{ id: string }[]>`SELECT id FROM user_roles WHERE name = ${role}`;
  if (!roles.length) throw new InternalServerError(`Required role '${role}' is not configured`);
  const roleId = roles[0].id;

  let userId!: string;

  if (id) {
    let oldEmail!: string;
    let userStatus!: string;
    let newInviteToken: string | undefined;

    await sql.begin(async (tx) => {
      const trx = asTransactionSql(tx);
      // 3. Lock the existing user while updating the account.
      await lockAccountUser(trx, id);

      // 4. Load the employee's current details, email, and status.
      const existingUsers = await trx<(DbRow<Pick<Users, 'id' | 'first_name' | 'last_name'>> & { email: string; status: 'invited' | 'active' | 'inactive' })[]>`
        SELECT u.id, u.first_name, u.last_name, uc.status, uc.email
        FROM users u
        INNER JOIN user_roles ur ON ur.id = u.role_id
        INNER JOIN user_credentials uc ON uc.user_id = u.id
        WHERE u.id = ${id} AND ur.name IN ('staff', 'project_manager', 'admin')
        LIMIT 1
      `;
      if (!existingUsers.length) throw new NotFoundError('Staff user not found');
      oldEmail = existingUsers[0].email;
      userStatus = existingUsers[0].status;

      // 5. Reject an email belonging to another account.
      const emailConflict = await trx<{ id: string }[]>`
        SELECT user_id AS id FROM user_credentials WHERE email = ${email} AND user_id != ${id} LIMIT 1
      `;
      if (emailConflict.length) throw new ConflictError('A user with this email already exists');

      // 6. Update the employee's name and role.
      const updatedUsers = await trx<DbRow<Users>[]>`
        UPDATE users
        SET first_name = ${firstName},
            last_name = ${lastName},
            role_id = ${roleId},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      if (!updatedUsers[0]) throw new NotFoundError('Staff user not found');
      userId = updatedUsers[0].id;

      // 7. Audit the employee update.
      await audit(
        trx,
        actorId,
        transactionId,
        'users',
        userId,
        'UPDATE',
        { id: existingUsers[0].id, firstName: existingUsers[0].firstName, lastName: existingUsers[0].lastName },
        { id: updatedUsers[0].id, firstName: updatedUsers[0].firstName, lastName: updatedUsers[0].lastName }
      );

      // 8. Save the account email.
      await trx`
        UPDATE user_credentials
        SET email = ${email},
            updated_at = NOW()
        WHERE user_id = ${id}
      `;

      if (email !== oldEmail && userStatus === 'invited') {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
        // 9. Invalidate unused links when the invitation address changes.
        await trx`
          DELETE FROM user_password_reset_tokens WHERE user_id = ${id} AND used_at IS NULL
        `;
        // 10. Save the replacement invitation token.
        await trx`
          INSERT INTO user_password_reset_tokens (user_id, token, expires_at)
          VALUES (${id}, ${tokenHash}, ${expiresAt})
        `;
        newInviteToken = rawToken;
      }

      // 11. Replace program assignments when supplied.
      if (programIds !== undefined) {
        await replaceUserProgramAssignments(trx, userId, programIds, actorId);
      }
    }).catch(rethrowAccountEmailConflict);

    // 12. Send invitation or email-change notifications after commit.
    if (email !== oldEmail) {
      if (userStatus === 'invited' && newInviteToken) {
        const inviteUrl = `${FRONTEND_URL}/reset-password?token=${newInviteToken}`;
        await sendInviteEmailChanged(email, firstName, inviteUrl);
      } else {
        // Active/inactive: notify both old and new address
        await sendEmailChangedOldAddress(oldEmail, firstName, email);
        await sendEmailChangedNewAddress(email, firstName);
      }
    }
  } else {
    // 13. Reject an email already used by another account.
    const existing = await sql<{ id: string }[]>`
      SELECT user_id AS id FROM user_credentials WHERE email = ${email} LIMIT 1
    `;
    if (existing.length) throw new ConflictError('A user with this email already exists');

    // 14. Prepare the initial password and invitation token.
    const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

    await sql.begin(async (tx) => {
      const trx = asTransactionSql(tx);

      // 15. Create the employee with the requested role.
      const newUsers = await trx<DbRow<Users>[]>`
        INSERT INTO users (first_name, last_name, role_id)
        VALUES (${firstName}, ${lastName}, ${roleId})
        RETURNING *
      `;
      if (!newUsers[0]) throw new InternalServerError('Account creation returned no user');
      userId = newUsers[0].id;
      // 16. Audit the employee creation.
      await audit(trx, actorId, transactionId, 'users', userId, 'INSERT', null, { id: newUsers[0].id, firstName: newUsers[0].firstName, lastName: newUsers[0].lastName, role });

      // 17. Create credentials with invited status.
      await trx<DbRow<UserCredentials>[]>`
        INSERT INTO user_credentials (user_id, email, password_hash, status)
        VALUES (${userId}, ${email}, ${unusableHash}, 'invited')
      `;

      // 18. Save the invitation token.
      await trx`
        INSERT INTO user_password_reset_tokens (user_id, token, expires_at)
        VALUES (${userId}, ${tokenHash}, ${expiresAt})
      `;

      // 19. Save the initial program assignments.
      await replaceUserProgramAssignments(trx, userId, programIds ?? [], actorId);
    }).catch(rethrowAccountEmailConflict);

    // 20. Send the employee invitation after commit.
    const inviteUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;
    await sendStaffInvite(email, firstName, inviteUrl);
  }

  // 21. Return the complete saved account.
  const staff = await sql<AccountRow[]>`
    SELECT ${accountRecordColumns}
    ${accountRecordFrom}
    WHERE u.id = ${userId}
  `;

  if (!staff[0]) throw new NotFoundError('Account not found');
  return staff[0];
}

/**
 * Creates youth credentials and a seven-day invitation for an existing profile.
 * Callers authorize the invitation; email failures reject after the account has been saved.
 * @param userId - Existing youth profile receiving login credentials; missing profiles are 404.
 * @param email - Validated invitation address; duplicate accounts or addresses are 409.
 * @param actorId - User recorded in the account audit.
 * @returns The invited email and status for the youth profile response.
 * @example inviteYouthAccount(youthId, 'alex@example.org', actorId) // { email: 'alex@example.org', status: 'invited' }
 */
export async function inviteYouthAccount(userId: string, email: string, actorId: string) {
  // 1. Prepare an invitation token and a password that cannot be used to sign in.
  const transactionId = crypto.randomUUID();
  const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
  let firstName!: string;

  await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);
    // 2. Lock the user until commit so competing account writes wait.
    await lockAccountUser(trx, userId);

    // 3. Require an existing youth profile and read the name for the invitation email.
    const youth = await trx<{ firstName: string }[]>`
      SELECT u.first_name
      FROM users u
      INNER JOIN youth_profiles yp ON yp.user_id = u.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;
    if (!youth.length) throw new NotFoundError('Youth profile not found');
    firstName = youth[0].firstName;

    // 4. Reject an existing account for this youth or email address.
    const existingAccount = await trx<{ userId: string }[]>`
      SELECT user_id FROM user_credentials
      WHERE user_id = ${userId} OR email = ${email}
      LIMIT 1
    `;
    if (existingAccount.length) throw new ConflictError('This youth or email already has an account');

    // 5. Create credentials with invited status.
    await trx`
      INSERT INTO user_credentials (user_id, email, password_hash, status)
      VALUES (${userId}, ${email}, ${unusableHash}, 'invited')
    `;
    // 6. Save the invitation token.
    await trx`
      INSERT INTO user_password_reset_tokens (user_id, token, expires_at)
      VALUES (${userId}, ${tokenHash}, ${expiresAt})
    `;
    // 7. Audit the credential creation.
    await audit(trx, actorId, transactionId, 'user_credentials', userId, 'INSERT', null, {
      userId,
      email,
      status: 'invited',
    });
  }).catch(error => {
    if (isUniqueViolation(error, 'user_credentials_email_key')
      || isUniqueViolation(error, 'user_credentials_user_id_key')) {
      throw Object.assign(new ConflictError('This youth or email already has an account'), { cause: error });
    }
    throw error;
  });

  // 8. Send the invitation after commit.
  await sendYouthInvite(email, firstName, `${FRONTEND_URL}/reset-password?token=${rawToken}`);
  return { email, status: 'invited' as const };
}

/**
 * Toggles an authorized account between active and inactive and audits the change.
 * Pending invitations are rejected with 409.
 * @param userId - Required account whose status changes.
 * @param actor - Actor whose authority is checked and whose ID is audited.
 * @returns The complete account row with its committed status.
 * @example toggleAccountStatus(activeYouthId, staffActor) // account row with status: 'inactive'
 */
export async function toggleAccountStatus(userId: string, actor: AccessTokenPayload) {
  // 1. Check authority over the account.
  assertCanManageAccount(actor, await getAccountRole(userId));
  const transactionId = crypto.randomUUID();
  const actorId = actor.userId;

  let result!: AccountRow;

  await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    // 2. Load the current account status.
    const existingUsers = await trx<(DbRow<Pick<Users, 'id' | 'first_name' | 'last_name'>> & { status: 'invited' | 'active' | 'inactive' })[]>`
      SELECT u.id, u.first_name, u.last_name, uc.status
      FROM users u
      INNER JOIN user_roles ur ON ur.id = u.role_id
      INNER JOIN user_credentials uc ON uc.user_id = u.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;
    if (!existingUsers.length) throw new NotFoundError('Staff user not found');

    const existing = existingUsers[0];

    // 3. Reject pending invitations; they must be revoked instead.
    if (existing.status === 'invited') {
      throw new ConflictError('Cannot deactivate a pending invite — use revoke invite instead');
    }

    const newStatus = existing.status === 'active' ? 'inactive' : 'active';

    // 4. Switch between active and inactive.
    await trx`
      UPDATE user_credentials SET status = ${newStatus}, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    // 5. Audit the status change.
    await audit(
      trx, actorId, transactionId, 'user_credentials', userId, 'UPDATE',
      { userId, status: existing.status },
      { userId, status: newStatus }
    );

    // 6. Load the complete updated account.
    const rows = await trx<AccountRow[]>`
      SELECT ${accountRecordColumns}
      ${accountRecordFrom}
      WHERE u.id = ${userId}
    `;
    if (!rows[0]) throw new InternalServerError('Updated account record is unavailable');
    result = rows[0];
  });

  return result;
}

/**
 * Revokes an authorized pending invitation, invalidates its reset links, and audits the deletion.
 * Youth profiles survive credential deletion; employee users are deleted with their dependent records.
 * @param userId - Required invited account; activated accounts are 409.
 * @param actor - Actor whose authority is checked and whose ID is audited.
 * @example revokeAccountInvite(invitedYouthId, staffActor) // removes credentials and preserves the youth profile
 */
export async function revokeAccountInvite(userId: string, actor: AccessTokenPayload) {
  // 1. Check authority over the invited account.
  const targetRole = await getAccountRole(userId);
  assertCanManageAccount(actor, targetRole);
  const transactionId = crypto.randomUUID();
  const actorId = actor.userId;

  await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);
    // 2. Lock the user so activation and revocation cannot overlap.
    await lockAccountUser(trx, userId);

    // 3. Load the account's current invitation status.
    const existingUsers = await trx<(DbRow<Pick<Users, 'id' | 'first_name' | 'last_name'>> & { status: 'invited' | 'active' | 'inactive' })[]>`
      SELECT u.id, u.first_name, u.last_name, uc.status
      FROM users u
      INNER JOIN user_roles ur ON ur.id = u.role_id
      INNER JOIN user_credentials uc ON uc.user_id = u.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;
    if (!existingUsers.length) throw new NotFoundError('Staff user not found');

    // 4. Reject accounts that have already activated.
    if (existingUsers[0].status !== 'invited') {
      throw new ConflictError('This user has already activated their account — use deactivate instead');
    }

    const existing = existingUsers[0];
    // 5. Audit the invitation removal.
    await audit(
      trx, actorId, transactionId, 'users', userId, 'DELETE',
      { id: existing.id, firstName: existing.firstName, lastName: existing.lastName, status: existing.status },
      null
    );

    // 6. Invalidate every invitation and password-reset link.
    await trx`DELETE FROM user_password_reset_tokens WHERE user_id = ${userId}`;

    if (targetRole === 'youth') {
      // 7. Remove youth credentials while preserving the profile.
      await trx`DELETE FROM user_credentials WHERE user_id = ${userId}`;
    } else {
      // 7. Remove the employee user created for the invitation.
      await trx`DELETE FROM users WHERE id = ${userId}`;
    }
  });
}

/**
 * Locks the surviving user row until the transaction ends, serializing invitation and reset changes.
 * Lock before validating credential state for a write or locking reset tokens; youth credential deletion keeps this row.
 * @param transaction - Existing transaction containing the complete credential/token operation.
 * @param userId - User whose invitation or password-reset state will be checked or changed.
 * @returns Whether the user still exists; missing users acquire no lock.
 * @example await lockAccountUser(trx, youthId) // blocks a competing activation until commit
 */
export async function lockAccountUser(transaction: typeof sql, userId: string): Promise<boolean> {
  // 1. Hold the user row lock until the caller's transaction ends.
  const users = await transaction<{ id: string }[]>`
    SELECT id FROM users WHERE id = ${userId} FOR UPDATE
  `;
  return users.length > 0;
}

/**
 * Returns the role for a required account; a missing credential-backed account is 404.
 * @param userId - Account whose stored role is required for authorization.
 * @example getAccountRole(staffAccountId) // 'staff'
 */
async function getAccountRole(userId: string): Promise<UserRole> {
  // 1. Read the credential-backed account's role for authorization.
  const accounts = await sql<{ role: UserRole }[]>`
    SELECT ur.name AS role
    FROM users u
    INNER JOIN user_roles ur ON ur.id = u.role_id
    INNER JOIN user_credentials uc ON uc.user_id = u.id
    WHERE u.id = ${userId}
    LIMIT 1
  `;
  if (!accounts.length) throw new NotFoundError('Account not found');
  return accounts[0].role;
}

/**
 * Replaces account program assignments inside the caller transaction; unavailable selections are 409.
 * @param trx - Existing transaction that rolls back deletion if validation or insertion fails.
 * @param staffId - Account receiving the replacement assignments.
 * @param programIds - Distinct validated program IDs; an empty list clears assignments.
 * @param actorId - Actor recorded as assignment creator.
 * @example replaceUserProgramAssignments(trx, staffId, [], actorId) // clears all program assignments
 */
async function replaceUserProgramAssignments(
  trx: typeof sql,
  staffId: string,
  programIds: string[],
  actorId: string,
) {
  // 1. Clear the previous program assignments.
  await trx`DELETE FROM user_program_assignments WHERE user_id = ${staffId}`;
  if (!programIds.length) return;

  // 2. Require every selected program to exist.
  const assignablePrograms = await trx<{ id: string }[]>`
    SELECT id
    FROM programs
    WHERE id = ANY(${sql.array(programIds)}::uuid[])
  `;
  if (assignablePrograms.length !== programIds.length) {
    throw new ConflictError('One or more selected programs cannot be assigned');
  }

  // 3. Save the replacement program assignments.
  await trx`
    INSERT INTO user_program_assignments (user_id, program_id, created_by)
    SELECT ${staffId}, selected.program_id, ${actorId}
    FROM UNNEST(${sql.array(programIds)}::uuid[]) AS selected(program_id)
  `;
}

/**
 * Translates the account email constraint to a contextual 409, preserving its cause.
 * Other failures are rethrown unchanged.
 * @param error - Rejection from an account transaction.
 * @example rethrowAccountEmailConflict(new Error('offline')) // rethrows that same error
 */
function rethrowAccountEmailConflict(error: unknown): never {
  if (isUniqueViolation(error, 'user_credentials_email_key')) {
    throw Object.assign(new ConflictError('A user with this email already exists'), { cause: error });
  }
  throw error;
}
