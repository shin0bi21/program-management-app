/**
 * Administrator seeding shared by reset and local import preparation.
 * The caller owns the connection and transaction passed to seedAdmin.
 */

import type { Sql } from 'postgres';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { requireEnv } from '../../../src/utils/env';

export interface AdminConfiguration {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AdminSeedResult {
  created: boolean;
  userId: string;
}

export interface AdminSeedOptions {
  resetExisting?: boolean;
}

interface AdminSeedConfiguration extends AdminConfiguration {
  databaseUrl: string;
}

/**
 * Reads required database and administrator environment values; missing configuration throws before any database connection.
 * @example adminSeedConfiguration().firstName // configured ADMIN_FIRST_NAME
 */
export function adminSeedConfiguration(): AdminSeedConfiguration {
  return {
    databaseUrl: requireEnv('DATABASE_URL'),
    email: requireEnv('ADMIN_EMAIL'),
    password: requireEnv('ADMIN_PASSWORD'),
    firstName: requireEnv('ADMIN_FIRST_NAME'),
    lastName: requireEnv('ADMIN_LAST_NAME'),
  };
}

/**
 * Seeds an administrator within the caller's active transaction using configured identity and credentials.
 * Existing accounts are preserved unless resetExisting is enabled; missing admin roles throw.
 * @example await seedAdmin(transaction, configuration) // { created: false, userId } for an existing account
 */
export async function seedAdmin(
  transaction: Sql,
  configuration: AdminConfiguration,
  options: AdminSeedOptions = {},
): Promise<AdminSeedResult> {
  // 1. Choose whether an existing administrator may be reset.
  const { resetExisting = false } = options;

  // 2. Lock and look up the same normalized identity within the caller transaction.
  // Normalize the lock key and lookup together so case variants cannot race.
  const email = configuration.email.trim();
  await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${email.toLowerCase()}, 0))`;

  const [existing] = await transaction<{ user_id: string }[]>`
    SELECT user_id FROM user_credentials WHERE lower(email) = lower(${email}) FOR UPDATE
  `;
  if (existing && !resetExisting) return { created: false, userId: existing.user_id };

  // 3. Require the admin role and hash credentials only when a write is needed.
  const [role] = await transaction<{ id: string }[]>`SELECT id FROM user_roles WHERE name = 'admin'`;
  if (!role) throw new Error('Admin role not found. Apply the database init before seeding an administrator.');

  const passwordHash = await bcrypt.hash(configuration.password, 10);
  // 4. Reset the selected account only when the caller enabled that mode.
  if (existing) {
    await transaction`UPDATE users SET role_id = ${role.id}, updated_at = NOW() WHERE id = ${existing.user_id}`;
    await transaction`UPDATE user_credentials SET password_hash = ${passwordHash}, status = 'active',
      email_verified = TRUE, updated_at = NOW() WHERE user_id = ${existing.user_id}`;
    return { created: false, userId: existing.user_id };
  }

  // 5. Create the user and credentials together in the caller transaction.
  const userId = crypto.randomUUID();
  await transaction`INSERT INTO users (id, first_name, last_name, role_id)
    VALUES (${userId}, ${configuration.firstName}, ${configuration.lastName}, ${role.id})`;
  await transaction`INSERT INTO user_credentials (user_id, email, password_hash, email_verified, status)
    VALUES (${userId}, ${email}, ${passwordHash}, TRUE, 'active')`;

  return { created: true, userId };
}


