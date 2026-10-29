/**
 * Auth suite helpers — covers the entire auth flow:
 *   login, 2FA verify, resend, refresh, logout, password-reset, full flow.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { hashDeviceFingerprint } from '../../src/utils/deviceUtils';
import { requireEnv } from '../../src/utils/env';
import { sql, seedTestUser, deleteTestUser } from '../shared/db';
import type { SeededUser } from '../shared/db';

const JWT_SECRET = requireEnv('JWT_SECRET');
const REFRESH_SECRET = requireEnv('REFRESH_SECRET');

// ─── Trusted Device ──────────────────────────────────────────────────────────

export async function seedTrustedDeviceUser(
  emailPrefix: string = 'trusted',
): Promise<{ user: SeededUser; deviceFingerprint: string }> {
  const user = await seedTestUser({ email: `${emailPrefix}-${Date.now()}@test.local` });
  const deviceFingerprint = `test-device-fp-${Date.now()}`;
  const deviceHash = hashDeviceFingerprint(deviceFingerprint);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO user_trusted_devices (user_id, device_hash, device_name, expires_at)
    VALUES (${user.userId}, ${deviceHash}, 'Test Device', ${expiresAt})
  `;

  return { user, deviceFingerprint };
}

// ─── 2FA ─────────────────────────────────────────────────────────────────────

export async function get2FACode(userId: string): Promise<string | null> {
  const codes = await sql<{ code: string }[]>`
    SELECT code FROM user_auth_codes
    WHERE user_id = ${userId}
      AND expires_at > NOW()
      AND used_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return codes.length > 0 ? codes[0].code : null;
}

export async function insertExpired2FACode(userId: string, code: string = '999999') {
  await sql`
    INSERT INTO user_auth_codes (user_id, code, expires_at)
    VALUES (${userId}, ${code}, NOW() - INTERVAL '1 minute')
  `;
}

// ─── Tokens ──────────────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['read:accounts', 'write:accounts', 'read:youth_profiles', 'write:youth_profiles', 'read:schools', 'read:programs', 'write:programs', 'write:enrollments', 'read:sessions', 'write:sessions', 'read:attendance', 'write:attendance', 'read:settings', 'write:settings'],
  staff: ['read:accounts', 'write:accounts', 'read:youth_profiles', 'write:youth_profiles', 'read:schools', 'read:programs', 'write:enrollments', 'read:sessions', 'write:sessions', 'read:attendance', 'write:attendance', 'read:settings', 'write:settings'],
  project_manager: ['read:accounts', 'write:accounts', 'read:youth_profiles', 'write:youth_profiles', 'read:schools', 'read:programs', 'write:programs', 'write:enrollments', 'read:sessions', 'write:sessions', 'read:attendance', 'write:attendance', 'read:settings', 'write:settings'],
  youth: [],
};

export function generateAccessToken(userId: string, email: string, role: string = 'admin') {
  return jwt.sign(
    { userId, email, role, permissions: ROLE_PERMISSIONS[role] ?? [], jti: crypto.randomBytes(16).toString('hex'), tokenType: 'access' },
    JWT_SECRET,
    { expiresIn: 900 },
  );
}

export function generateRefreshToken(userId: string, email: string = 'test@test.local') {
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign({ userId, email, jti, tokenType: 'refresh' }, REFRESH_SECRET, { expiresIn: 604800 });
  return { token, jti };
}

export function generateRefreshTokenWithoutJTI(userId: string, email: string = 'test@test.local') {
  return jwt.sign({ userId, email, tokenType: 'refresh' }, REFRESH_SECRET, { expiresIn: 604800 });
}

export async function storeRefreshToken(userId: string, jti: string, token: string): Promise<string> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenFamily = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO user_refresh_tokens (user_id, jti, token_hash, token_family, expires_at)
    VALUES (${userId}, ${jti}, ${tokenHash}, ${tokenFamily}, ${expiresAt})
  `;

  return tokenFamily;
}

export async function generateAndStoreRefreshToken(userId: string, email: string): Promise<string> {
  const { token, jti } = generateRefreshToken(userId, email);
  await storeRefreshToken(userId, jti, token);
  return token;
}

// ─── Password Reset ──────────────────────────────────────────────────────────

export async function insertResetToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await sql`
    INSERT INTO user_password_reset_tokens (user_id, token, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;

  return rawToken;
}

export async function insertExpiredResetToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await sql`
    INSERT INTO user_password_reset_tokens (user_id, token, expires_at)
    VALUES (${userId}, ${tokenHash}, NOW() - INTERVAL '1 minute')
  `;

  return rawToken;
}

export async function insertUsedResetToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await sql`
    INSERT INTO user_password_reset_tokens (user_id, token, expires_at, used_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt}, NOW())
  `;

  return rawToken;
}

// ─── Cookie helper ───────────────────────────────────────────────────────────

/** Safely extract a cookie value from set-cookie headers (handles string | string[]). */
export function extractCookie(headers: Record<string, unknown>, name: string): string | undefined {
  const raw = headers['set-cookie'];
  const cookies: string[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  return match ? match.split(';')[0].split('=').slice(1).join('=') : undefined;
}

export { seedTestUser, deleteTestUser, sql };
