/**
 * Users suite helpers.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../../src/utils/env';
import { seedTestUser, deleteTestUser } from '../shared/db';

const JWT_SECRET = requireEnv('JWT_SECRET');

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['read:staff', 'write:staff', 'read:youth', 'write:youth', 'read:schools', 'read:settings', 'write:settings'],
  staff: ['read:youth', 'write:youth', 'read:schools'],
  youth: [],
};

/**
 * Generate a valid access token with a specific role.
 */
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

/**
 * Generate an already-expired access token.
 */
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

export { seedTestUser, deleteTestUser };
