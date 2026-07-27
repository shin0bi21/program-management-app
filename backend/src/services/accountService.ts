import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { audit } from './auditService';
import { sql, asTransactionSql } from '../db/client';
import type { Users, UserCredentials } from '../types/database';
import type { DbRow } from '../types/db';
import type { AccessTokenPayload, UserRole } from '../types/auth';
import type { AccountQuery, SetAccountInput } from '../validation/accountSchemas';
import { sendStaffInvite, sendYouthInvite, sendInviteEmailChanged, sendEmailChangedOldAddress, sendEmailChangedNewAddress } from '../utils/emailService';
import { ConflictError, NotFoundError, BadRequestError } from '../errors';
import { assertCanCreateAccount, assertCanManageAccount } from '../policies/accountPolicy';
import { applyAccountFilters } from './queryFilters/accountFilters';

export type AccountRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'created_at'>> &
  DbRow<Pick<UserCredentials, 'status'>> & {
    email: string;
    role: string;
    programIds: string[];
  };

export async function getAccounts(actor: AccessTokenPayload, filters: AccountQuery) {
  const where = applyAccountFilters(actor, filters);
  return sql<AccountRow[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      uc.status,
      u.created_at,
      uc.email,
      ur.name AS role,
      ARRAY(
        SELECT assignment.program_id
        FROM staff_program_assignments assignment
        WHERE assignment.staff_id = u.id
        ORDER BY assignment.program_id
      ) AS program_ids
    FROM users u
    INNER JOIN user_credentials uc ON uc.user_id = u.id
    INNER JOIN user_roles ur ON ur.id = u.role_id
    WHERE ${where}
    ORDER BY u.first_name ASC, u.last_name ASC
  `;
}

async function getAccountRole(userId: string): Promise<UserRole> {
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

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function replaceStaffProgramAssignments(
  trx: typeof sql,
  staffId: string,
  role: 'staff' | 'admin',
  programIds: string[],
  actorId: string,
) {
  await trx`DELETE FROM staff_program_assignments WHERE staff_id = ${staffId}`;
  if (role !== 'staff' || !programIds.length) return;

  const assignablePrograms = await trx<{ id: string }[]>`
    SELECT id
    FROM programs
    WHERE id = ANY(${sql.array(programIds)}::uuid[])
      AND roster_mode = 'enrolled'
  `;
  if (assignablePrograms.length !== programIds.length) {
    throw new ConflictError('One or more selected programs cannot be assigned');
  }

  await trx`
    INSERT INTO staff_program_assignments (staff_id, program_id, created_by)
    SELECT ${staffId}, selected.program_id, ${actorId}
    FROM UNNEST(${sql.array(programIds)}::uuid[]) AS selected(program_id)
  `;
}

export async function inviteYouthAccount(userId: string, email: string, actorId: string) {
  const transactionId = crypto.randomUUID();
  const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
  let firstName!: string;

  await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);
    const youth = await trx<{ firstName: string }[]>`
      SELECT u.first_name
      FROM users u
      INNER JOIN youth_profiles yp ON yp.user_id = u.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;
    if (!youth.length) throw new NotFoundError('Youth profile not found');
    firstName = youth[0].firstName;

    const existingAccount = await trx<{ userId: string }[]>`
      SELECT user_id FROM user_credentials
      WHERE user_id = ${userId} OR email = ${email}
      LIMIT 1
    `;
    if (existingAccount.length) throw new ConflictError('This youth or email already has an account');

    await trx`
      INSERT INTO user_credentials (user_id, email, password_hash, status)
      VALUES (${userId}, ${email}, ${unusableHash}, 'invited')
    `;
    await trx`
      INSERT INTO user_password_reset_tokens (user_id, token, expires_at)
      VALUES (${userId}, ${tokenHash}, ${expiresAt})
    `;
    await audit(trx, actorId, transactionId, 'user_credentials', userId, 'INSERT', null, {
      userId,
      email,
      status: 'invited',
    });
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  await sendYouthInvite(email, firstName, `${frontendUrl}/reset-password?token=${rawToken}`);
  return { email, status: 'invited' as const };
}

export async function setAccount(data: SetAccountInput, actor: AccessTokenPayload) {
  const { id, firstName, lastName, email, role = 'staff', programIds } = data;
  if (id) {
    assertCanManageAccount(actor, await getAccountRole(id));
  }
  assertCanCreateAccount(actor, role);
  const transactionId = crypto.randomUUID();
  const actorId = actor.userId;

  // Get role ID
  const roles = await sql<{ id: string }[]>`SELECT id FROM user_roles WHERE name = ${role}`;
  if (!roles.length) throw new ConflictError(`Role '${role}' not found`);
  const roleId = roles[0].id;

  let userId!: string;

  if (id) {
    // UPDATE path
    let oldEmail!: string;
    let userStatus!: string;
    let newInviteToken: string | undefined;

    await sql.begin(async (tx) => {
      const trx = asTransactionSql(tx);

      // Check if user exists and is staff/admin; fetch current email too
      const existingUsers = await trx<(DbRow<Pick<Users, 'id' | 'first_name' | 'last_name'>> & { email: string; status: 'invited' | 'active' | 'inactive' })[]>`
        SELECT u.id, u.first_name, u.last_name, uc.status, uc.email
        FROM users u
        INNER JOIN user_roles ur ON ur.id = u.role_id
        INNER JOIN user_credentials uc ON uc.user_id = u.id
        WHERE u.id = ${id} AND ur.name IN ('staff', 'admin')
        LIMIT 1
      `;
      if (!existingUsers.length) throw new NotFoundError('Staff user not found');
      oldEmail = existingUsers[0].email;
      userStatus = existingUsers[0].status;

      // Check for email conflict (excluding current user)
      const emailConflict = await trx<{ id: string }[]>`
        SELECT user_id AS id FROM user_credentials WHERE email = ${email} AND user_id != ${id} LIMIT 1
      `;
      if (emailConflict.length) throw new ConflictError('A user with this email already exists');

      // Update user
      const updatedUsers = await trx<DbRow<Users>[]>`
        UPDATE users
        SET first_name = ${firstName},
            last_name = ${lastName},
            role_id = ${roleId},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      userId = updatedUsers[0].id;

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

      // Update email in credentials
      await trx`
        UPDATE user_credentials
        SET email = ${email},
            updated_at = NOW()
        WHERE user_id = ${id}
      `;

      // If email changed and user is invited: rotate invite token inside the transaction
      if (email !== oldEmail && userStatus === 'invited') {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
        await trx`
          DELETE FROM user_password_reset_tokens WHERE user_id = ${id} AND used_at IS NULL
        `;
        await trx`
          INSERT INTO user_password_reset_tokens (user_id, token, expires_at)
          VALUES (${id}, ${tokenHash}, ${expiresAt})
        `;
        newInviteToken = rawToken;
      }

      if (role === 'admin' || programIds !== undefined) {
        await replaceStaffProgramAssignments(trx, userId, role, programIds ?? [], actorId);
      }
    });

    // Post-transaction: send emails based on what changed
    if (email !== oldEmail) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      if (userStatus === 'invited' && newInviteToken) {
        const inviteUrl = `${frontendUrl}/reset-password?token=${newInviteToken}`;
        await sendInviteEmailChanged(email, firstName, inviteUrl);
      } else {
        // Active/inactive: notify both old and new address
        await sendEmailChangedOldAddress(oldEmail, firstName, email);
        await sendEmailChangedNewAddress(email, firstName);
      }
    }
  } else {
    // CREATE path (invite new staff)
    const existing = await sql<{ id: string }[]>`
      SELECT user_id AS id FROM user_credentials WHERE email = ${email} LIMIT 1
    `;
    if (existing.length) throw new ConflictError('A user with this email already exists');

    const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

    await sql.begin(async (tx) => {
      const trx = asTransactionSql(tx);

      const newUsers = await trx<DbRow<Users>[]>`
        INSERT INTO users (first_name, last_name, role_id)
        VALUES (${firstName}, ${lastName}, ${roleId})
        RETURNING *
      `;
      userId = newUsers[0].id;
      await audit(trx, actorId, transactionId, 'users', userId, 'INSERT', null, { id: newUsers[0].id, firstName: newUsers[0].firstName, lastName: newUsers[0].lastName, role });

      await trx<DbRow<UserCredentials>[]>`
        INSERT INTO user_credentials (user_id, email, password_hash, status)
        VALUES (${userId}, ${email}, ${unusableHash}, 'invited')
      `;

      await trx`
        INSERT INTO user_password_reset_tokens (user_id, token, expires_at)
        VALUES (${userId}, ${tokenHash}, ${expiresAt})
      `;

      await replaceStaffProgramAssignments(trx, userId, role, programIds ?? [], actorId);
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    await sendStaffInvite(email, firstName, inviteUrl);
  }

  // Return updated/created staff user
  const staff = await sql<AccountRow[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      uc.status,
      u.created_at,
      uc.email,
      ur.name AS role,
      ARRAY(
        SELECT assignment.program_id
        FROM staff_program_assignments assignment
        WHERE assignment.staff_id = u.id
        ORDER BY assignment.program_id
      ) AS program_ids
    FROM users u
    INNER JOIN user_credentials uc ON uc.user_id = u.id
    INNER JOIN user_roles ur ON ur.id = u.role_id
    WHERE u.id = ${userId}
  `;

  return staff[0];
}

export async function revokeAccountInvite(userId: string, actor: AccessTokenPayload) {
  const targetRole = await getAccountRole(userId);
  assertCanManageAccount(actor, targetRole);
  const transactionId = crypto.randomUUID();
  const actorId = actor.userId;

  await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    const existingUsers = await trx<(DbRow<Pick<Users, 'id' | 'first_name' | 'last_name'>> & { status: 'invited' | 'active' | 'inactive' })[]>`
      SELECT u.id, u.first_name, u.last_name, uc.status
      FROM users u
      INNER JOIN user_roles ur ON ur.id = u.role_id
      INNER JOIN user_credentials uc ON uc.user_id = u.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;
    if (!existingUsers.length) throw new NotFoundError('Staff user not found');

    // Only allow hard delete for pending invites
    if (existingUsers[0].status !== 'invited') {
      throw new BadRequestError('This user has already activated their account — use deactivate instead');
    }

    const existing = existingUsers[0];
    await audit(
      trx, actorId, transactionId, 'users', userId, 'DELETE',
      { id: existing.id, firstName: existing.firstName, lastName: existing.lastName, status: existing.status },
      null
    );

    if (targetRole === 'youth') {
      await trx`DELETE FROM user_credentials WHERE user_id = ${userId}`;
    } else {
      // Staff/admin invitations create the user, so revocation removes it.
      await trx`DELETE FROM users WHERE id = ${userId}`;
    }
  });
}

export async function toggleAccountStatus(userId: string, actor: AccessTokenPayload) {
  assertCanManageAccount(actor, await getAccountRole(userId));
  const transactionId = crypto.randomUUID();
  const actorId = actor.userId;

  let result!: AccountRow;

  await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

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

    // Block toggling a pending invite — those must be revoked via DELETE
    if (existing.status === 'invited') {
      throw new BadRequestError('Cannot deactivate a pending invite — use revoke invite instead');
    }

    const newStatus = existing.status === 'active' ? 'inactive' : 'active';

    await trx`
      UPDATE user_credentials SET status = ${newStatus}, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    await audit(
      trx, actorId, transactionId, 'user_credentials', userId, 'UPDATE',
      { userId, status: existing.status },
      { userId, status: newStatus }
    );

    const rows = await trx<AccountRow[]>`
      SELECT
        u.id, u.first_name, u.last_name, uc.status, u.created_at,
        uc.email, ur.name AS role,
        ARRAY(
          SELECT assignment.program_id
          FROM staff_program_assignments assignment
          WHERE assignment.staff_id = u.id
          ORDER BY assignment.program_id
        ) AS program_ids
      FROM users u
      INNER JOIN user_credentials uc ON uc.user_id = u.id
      INNER JOIN user_roles ur ON ur.id = u.role_id
      WHERE u.id = ${userId}
    `;
    result = rows[0];
  });

  return result;
}
