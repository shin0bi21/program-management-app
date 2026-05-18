import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { audit } from './auditService';
import { sql } from '../db/client';
import type { Users, UserCredentials } from '../types/database';
import type { DbRow } from '../types/db';
import type { CreateStaffInput } from '../validation/staffSchemas';
import { sendStaffInvite } from '../utils/emailService';
import { ConflictError } from '../errors';

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

export async function setStaff(data: CreateStaffInput, actorId: string) {
  const { firstName, lastName, email, role = 'staff' } = data;

  const existing = await sql<{ id: string }[]>`
    SELECT user_id AS id FROM user_credentials WHERE email = ${email} LIMIT 1
  `;
  if (existing.length) throw new ConflictError('A user with this email already exists');

  const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const transactionId = crypto.randomUUID();

  const roles = await sql<{ id: string }[]>`SELECT id FROM user_roles WHERE name = ${role}`;
  if (!roles.length) throw new ConflictError(`Role '${role}' not found`);
  const roleId = roles[0].id;

  const newUsers = await sql<DbRow<Users>[]>`
    INSERT INTO users (first_name, last_name, role_id, active)
    VALUES (${firstName}, ${lastName}, ${roleId}, false)
    RETURNING *
  `;
  const userId = newUsers[0].id;
  await audit(sql, actorId, transactionId, 'users', userId, 'INSERT', null, { id: newUsers[0].id, firstName: newUsers[0].firstName, lastName: newUsers[0].lastName, role });

  await sql<DbRow<UserCredentials>[]>`
    INSERT INTO user_credentials (user_id, email, password_hash)
    VALUES (${userId}, ${email}, ${unusableHash})
  `;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  await sql`
    INSERT INTO user_password_reset_tokens (user_id, token, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
  await sendStaffInvite(email, firstName, inviteUrl);

  const created = await sql<StaffRow[]>`
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

  return created[0];
}
