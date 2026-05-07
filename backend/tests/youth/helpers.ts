/**
 * Youth suite helpers.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../../src/utils/env';
import { sql } from '../shared/db';

const JWT_SECRET = requireEnv('JWT_SECRET');

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['read:staff', 'write:staff', 'read:youth', 'write:youth', 'read:schools', 'read:settings', 'write:settings'],
  staff: ['read:youth', 'write:youth', 'read:schools'],
  youth: [],
};

export function generateToken(
  userId: string,
  role: 'admin' | 'staff' | 'youth',
  email: string = 'test@test.local',
) {
  return jwt.sign(
    { userId, email, role, permissions: ROLE_PERMISSIONS[role] ?? [], jti: crypto.randomBytes(16).toString('hex'), tokenType: 'access' },
    JWT_SECRET,
    { expiresIn: 900 },
  );
}

export function generateExpiredToken(userId: string, role: 'admin' | 'staff' | 'youth' = 'admin') {
  return jwt.sign(
    {
      userId,
      email: 'test@test.local',
      role,
      permissions: ROLE_PERMISSIONS[role] ?? [],
      jti: crypto.randomBytes(16).toString('hex'),
      tokenType: 'access',
      iat: Math.floor(Date.now() / 1000) - 3600,
      exp: Math.floor(Date.now() / 1000) - 1,
    },
    JWT_SECRET,
  );
}

/**
 * Delete a youth user and their associated addresses/contacts.
 * Deleting the user cascades: youth_profiles, user_has_addresses, user_has_contacts.
 * The addresses/contacts rows themselves are orphaned so we clean those too.
 */
export async function deleteTestYouth(userId: string): Promise<void> {
  // Collect address and contact IDs before cascading deletes remove the junctions
  const addressIds = await sql<{ id: string }[]>`
    SELECT a.id FROM addresses a
    INNER JOIN user_has_addresses uha ON uha.address_id = a.id
    WHERE uha.user_id = ${userId}
  `;

  const contactIds = await sql<{ id: string }[]>`
    SELECT c.id FROM contacts c
    INNER JOIN user_has_contacts uhc ON uhc.contact_id = c.id
    WHERE uhc.user_id = ${userId}
  `;

  // Delete the user (cascades to youth_profiles, junction tables, credentials)
  await sql`DELETE FROM users WHERE id = ${userId}`;

  // Clean up orphaned address/contact rows
  if (addressIds.length > 0) {
    await sql`DELETE FROM addresses WHERE id IN ${sql(addressIds.map(r => r.id))}`;
  }
  if (contactIds.length > 0) {
    await sql`DELETE FROM contacts WHERE id IN ${sql(contactIds.map(r => r.id))}`;
  }
}

export { sql };
