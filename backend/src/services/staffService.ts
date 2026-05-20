import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { audit } from './auditService';
import { sql, asTransactionSql } from '../db/client';
import type { Users, UserCredentials } from '../types/database';
import type { DbRow } from '../types/db';
import type { SetStaffInput } from '../validation/staffSchemas';
import { sendStaffInvite } from '../utils/emailService';
import { ConflictError, NotFoundError } from '../errors';

type StaffRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'active' | 'created_at'>> & {
    email: string;
    role: string;
  };

export async function getStaff() {
  return sql<StaffRow[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.active,
      u.created_at,
      uc.email,
      ur.name AS role
    FROM users u
    INNER JOIN user_credentials uc ON uc.user_id = u.id
    INNER JOIN user_roles ur ON ur.id = u.role_id
    WHERE ur.name IN ('staff', 'admin')
    ORDER BY u.first_name ASC, u.last_name ASC
  `;
}

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function setStaff(data: SetStaffInput, actorId: string) {
  const { id, firstName, lastName, email, role = 'staff' } = data;
  const transactionId = crypto.randomUUID();

  // Get role ID
  const roles = await sql<{ id: string }[]>`SELECT id FROM user_roles WHERE name = ${role}`;
  if (!roles.length) throw new ConflictError(`Role '${role}' not found`);
  const roleId = roles[0].id;

  let userId!: string;

  if (id) {
    // UPDATE path
    await sql.begin(async (tx) => {
      const trx = asTransactionSql(tx);

      // Check if user exists and is staff/admin
      const existingUsers = await trx<DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'active'>>[]>`
        SELECT u.id, u.first_name, u.last_name, u.active
        FROM users u
        INNER JOIN user_roles ur ON ur.id = u.role_id
        WHERE u.id = ${id} AND ur.name IN ('staff', 'admin')
        LIMIT 1
      `;
      if (!existingUsers.length) throw new NotFoundError('Staff user not found');

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
        { id: existingUsers[0].id, firstName: existingUsers[0].firstName, lastName: existingUsers[0].lastName, active: existingUsers[0].active },
        { id: updatedUsers[0].id, firstName: updatedUsers[0].firstName, lastName: updatedUsers[0].lastName, active: updatedUsers[0].active }
      );

      // Update email in credentials
      await trx`
        UPDATE user_credentials
        SET email = ${email},
            updated_at = NOW()
        WHERE user_id = ${id}
      `;
    });
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
        INSERT INTO users (first_name, last_name, role_id, active)
        VALUES (${firstName}, ${lastName}, ${roleId}, false)
        RETURNING *
      `;
      userId = newUsers[0].id;
      await audit(trx, actorId, transactionId, 'users', userId, 'INSERT', null, { id: newUsers[0].id, firstName: newUsers[0].firstName, lastName: newUsers[0].lastName, role });

      await trx<DbRow<UserCredentials>[]>`
        INSERT INTO user_credentials (user_id, email, password_hash)
        VALUES (${userId}, ${email}, ${unusableHash})
      `;

      await trx`
        INSERT INTO user_password_reset_tokens (user_id, token, expires_at)
        VALUES (${userId}, ${tokenHash}, ${expiresAt})
      `;
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    await sendStaffInvite(email, firstName, inviteUrl);
  }

  // Return updated/created staff user
  const staff = await sql<StaffRow[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.active,
      u.created_at,
      uc.email,
      ur.name AS role
    FROM users u
    INNER JOIN user_credentials uc ON uc.user_id = u.id
    INNER JOIN user_roles ur ON ur.id = u.role_id
    WHERE u.id = ${userId}
  `;

  return staff[0];
}

export async function deleteStaff(userId: string, actorId: string) {
  const transactionId = crypto.randomUUID();

  await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    // Check if user exists and is staff/admin
    const existingUsers = await trx<DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'active'>>[]>`
      SELECT u.id, u.first_name, u.last_name, u.active
      FROM users u
      INNER JOIN user_roles ur ON ur.id = u.role_id
      WHERE u.id = ${userId} AND ur.name IN ('staff', 'admin')
      LIMIT 1
    `;
    if (!existingUsers.length) throw new NotFoundError('Staff user not found');

    const existing = existingUsers[0];

    // Soft delete by setting active to false
    await trx`
      UPDATE users
      SET active = false,
          updated_at = NOW()
      WHERE id = ${userId}
    `;

    await audit(
      trx,
      actorId,
      transactionId,
      'users',
      userId,
      'UPDATE',
      { id: existing.id, firstName: existing.firstName, lastName: existing.lastName, active: existing.active },
      { id: existing.id, firstName: existing.firstName, lastName: existing.lastName, active: false }
    );

    // Revoke any pending reset tokens (for invited but not yet activated users)
    await trx`
      UPDATE user_password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = ${userId} AND used_at IS NULL
    `;
  });
}
