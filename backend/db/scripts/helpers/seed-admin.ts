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

export function adminSeedConfiguration(): AdminSeedConfiguration {
  return {
    databaseUrl: requireEnv('DATABASE_URL'),
    email: requireEnv('ADMIN_EMAIL'),
    password: requireEnv('ADMIN_PASSWORD'),
    firstName: requireEnv('ADMIN_FIRST_NAME'),
    lastName: requireEnv('ADMIN_LAST_NAME'),
  };
}

/** Requires the caller's active transaction; existing accounts are preserved unless resetExisting is enabled. */
export async function seedAdmin(
  transaction: Sql,
  configuration: AdminConfiguration,
  options: AdminSeedOptions = {},
): Promise<AdminSeedResult> {
  const { resetExisting = false } = options;

  // Normalize the lock key and lookup together so case variants cannot race.
  const email = configuration.email.trim();
  await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${email.toLowerCase()}, 0))`;

  const [existing] = await transaction<{ user_id: string }[]>`
    SELECT user_id FROM user_credentials WHERE lower(email) = lower(${email}) FOR UPDATE
  `;
  if (existing && !resetExisting) return { created: false, userId: existing.user_id };

  const [role] = await transaction<{ id: string }[]>`SELECT id FROM user_roles WHERE name = 'admin'`;
  if (!role) throw new Error('Admin role not found. Apply the database init before seeding an administrator.');

  const passwordHash = await bcrypt.hash(configuration.password, 10);
  if (existing) {
    await transaction`UPDATE users SET role_id = ${role.id}, updated_at = NOW() WHERE id = ${existing.user_id}`;
    await transaction`UPDATE user_credentials SET password_hash = ${passwordHash}, status = 'active',
      email_verified = TRUE, updated_at = NOW() WHERE user_id = ${existing.user_id}`;
    return { created: false, userId: existing.user_id };
  }

  const userId = crypto.randomUUID();
  await transaction`INSERT INTO users (id, first_name, last_name, role_id)
    VALUES (${userId}, ${configuration.firstName}, ${configuration.lastName}, ${role.id})`;
  await transaction`INSERT INTO user_credentials (user_id, email, password_hash, email_verified, status)
    VALUES (${userId}, ${email}, ${passwordHash}, TRUE, 'active')`;

  return { created: true, userId };
}


