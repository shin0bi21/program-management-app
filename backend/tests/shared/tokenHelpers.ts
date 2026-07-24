/**
 * Shared token generation helpers for all test suites.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../../src/utils/env';

const JWT_SECRET = requireEnv('JWT_SECRET');

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['read:accounts', 'write:accounts', 'read:youth_profiles', 'write:youth_profiles', 'read:schools', 'write:schools', 'read:programs', 'write:programs', 'read:cohorts', 'write:cohorts', 'read:attendance', 'write:attendance', 'read:outreach', 'write:outreach', 'read:settings', 'write:settings'],
  staff: ['read:accounts', 'write:accounts', 'read:youth_profiles', 'write:youth_profiles', 'read:schools', 'write:schools', 'read:programs', 'read:cohorts', 'write:cohorts', 'read:attendance', 'write:attendance', 'read:outreach', 'write:outreach', 'read:settings', 'write:settings'],
  youth: [],
};

export function generateToken(
  userId: string,
  role: string,
  email: string = 'test@test.local',
) {
  return jwt.sign(
    { userId, email, role, permissions: ROLE_PERMISSIONS[role] ?? [], jti: crypto.randomBytes(16).toString('hex'), tokenType: 'access' },
    JWT_SECRET,
    { expiresIn: 900 },
  );
}

export function generateExpiredToken(userId: string, role: string = 'admin') {
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
