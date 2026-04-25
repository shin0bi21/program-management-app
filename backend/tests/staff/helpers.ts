/**
 * Users suite helpers.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../../src/utils/env';
import { seedTestUser, deleteTestUser } from '../shared/db';

const JWT_SECRET = requireEnv('JWT_SECRET');

/**
 * Generate a valid access token with a specific permission level.
 */
export function generateToken(
  userId: string,
  permission: 'admin' | 'staff' | 'youth',
  email: string = 'test@test.local',
) {
  return jwt.sign(
    { userId, email, permission, jti: crypto.randomBytes(16).toString('hex'), tokenType: 'access' },
    JWT_SECRET,
    { expiresIn: 900 },
  );
}

/**
 * Generate an already-expired access token.
 */
export function generateExpiredToken(userId: string, permission: 'admin' | 'staff' | 'youth' = 'admin') {
  return jwt.sign(
    {
      userId,
      email: 'test@test.local',
      permission,
      jti: crypto.randomBytes(16).toString('hex'),
      tokenType: 'access',
      iat: Math.floor(Date.now() / 1000) - 3600,
      exp: Math.floor(Date.now() / 1000) - 1,
    },
    JWT_SECRET,
  );
}

export { seedTestUser, deleteTestUser };
