/**
 * Shared database helpers for all test suites.
 * Provides: seedTestUser, deleteTestUser, and raw sql access.
 */
import bcrypt from 'bcryptjs';
import { sql } from '../../src/db/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeededUser {
  userId: string;
  email: string;
  password: string;        // plaintext — for login tests
  firstName: string;
  lastName: string;
  role: string;
}

export interface SeedOverrides {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'staff' | 'youth';
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User',
  role: 'admin' as const,
};

// ─── Seed a user into the DB ─────────────────────────────────────────────────

export async function seedTestUser(overrides: SeedOverrides = {}): Promise<SeededUser> {
  const data = {
    ...DEFAULTS,
    email: `seed-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
    ...overrides,
  };

  const passwordHash = await bcrypt.hash(data.password, 10);

  const [roleRow] = await sql<{ id: string }[]>`SELECT id FROM user_roles WHERE name = ${data.role}`;
  if (!roleRow) throw new Error(`Role '${data.role}' not found in user_roles`);

  const [user] = await sql<{ id: string }[]>`
    INSERT INTO users (first_name, last_name, role_id, status)
    VALUES (${data.firstName}, ${data.lastName}, ${roleRow.id}, 'active')
    RETURNING id
  `;

  await sql`
    INSERT INTO user_credentials (user_id, email, password_hash, email_verified)
    VALUES (${user.id}, ${data.email}, ${passwordHash}, false)
  `;

  return {
    userId: user.id,
    email: data.email,
    password: data.password,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
  };
}

// ─── Delete a seeded user (cascade-safe) ─────────────────────────────────────

export async function deleteTestUser(userId: string): Promise<void> {
  await sql`DELETE FROM user_auth_codes WHERE user_id = ${userId}`;
  await sql`DELETE FROM user_refresh_tokens WHERE user_id = ${userId}`;
  await sql`DELETE FROM user_password_reset_tokens WHERE user_id = ${userId}`;
  await sql`DELETE FROM user_trusted_devices WHERE user_id = ${userId}`;
  await sql`DELETE FROM system_revoked_tokens WHERE user_id = ${userId}`;
  await sql`DELETE FROM user_credentials WHERE user_id = ${userId}`;
  await sql`DELETE FROM users WHERE id = ${userId}`;
}

export { sql };
