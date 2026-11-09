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

/**
 * Creates credentials and an unexpired trusted-device record for login tests.
 * @param emailPrefix - Prefix for the unique fixture email address.
 * @example await seedTrustedDeviceUser('trusted-login') // user and raw device fingerprint
 */
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

/**
 * Reads the newest unused, unexpired verification code for an account.
 * @param userId - Account whose emailed verification code is needed.
 * @example await get2FACode(userId) // six-digit code, or null when none is available
 */
export async function get2FACode(userId: string): Promise<string | null> {
  const codes = await sql<{ code: string }[]>`
    SELECT code
    FROM user_auth_codes
    WHERE user_id = ${userId}
      AND expires_at > NOW()
      AND used_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return codes.length > 0 ? codes[0].code : null;
}

/**
 * Stores an expired code so verification tests can exercise rejection.
 * @param code - Code to submit to the verification endpoint.
 * @example await insertExpired2FACode(userId, '888888') // code expired one minute ago
 */
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

/**
 * Signs an access token with the fixture role permissions and a fresh identifier.
 * @param role - Role whose test permissions should be embedded.
 * @example generateAccessToken(userId, email, 'staff') // raw signed access token
 */
export function generateAccessToken(userId: string, email: string, role: string = 'admin') {
  return jwt.sign(
    { userId, email, role, permissions: ROLE_PERMISSIONS[role] ?? [], jti: crypto.randomBytes(16).toString('hex'), tokenType: 'access' },
    JWT_SECRET,
    { expiresIn: 900 },
  );
}

/**
 * Signs a refresh token and returns its identifier for database seeding.
 * @param userId - Account to identify in the signed token.
 * @example generateRefreshToken(userId) // raw token and matching jti
 */
export function generateRefreshToken(userId: string, email: string = 'test@test.local') {
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign({ userId, email, jti, tokenType: 'refresh' }, REFRESH_SECRET, { expiresIn: 604800 });
  return { token, jti };
}

/**
 * Signs a legacy refresh token without an identifier to test format rejection.
 * @param userId - Account to identify in the rejected token.
 * @example generateRefreshTokenWithoutJTI(userId) // signed token missing jti
 */
export function generateRefreshTokenWithoutJTI(userId: string, email: string = 'test@test.local') {
  return jwt.sign({ userId, email, tokenType: 'refresh' }, REFRESH_SECRET, { expiresIn: 604800 });
}

/**
 * Stores a raw refresh token as a hash in a new seven-day fixture family.
 * @param token - Raw signed refresh token; only its SHA-256 hash is stored.
 * @example await storeRefreshToken(userId, jti, token) // stored token family ID
 */
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

/**
 * Signs a refresh token, stores its hash, and returns the raw cookie value.
 * @param userId - Account that owns the new fixture session.
 * @example await generateAndStoreRefreshToken(userId, email) // raw refresh token
 */
export async function generateAndStoreRefreshToken(userId: string, email: string): Promise<string> {
  const { token, jti } = generateRefreshToken(userId, email);
  await storeRefreshToken(userId, jti, token);
  return token;
}

// ─── Password Reset ──────────────────────────────────────────────────────────

/**
 * Stores a one-hour reset-token hash and returns the raw secret for a request.
 * @param userId - Account receiving the reset link.
 * @example await insertResetToken(userId) // raw token accepted once by password reset
 */
export async function insertResetToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await sql`
    INSERT INTO user_password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;

  return rawToken;
}

/**
 * Stores an expired reset-token hash and returns the raw secret for rejection tests.
 * @param userId - Account receiving the expired reset link.
 * @example await insertExpiredResetToken(userId) // raw token expired one minute ago
 */
export async function insertExpiredResetToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await sql`
    INSERT INTO user_password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, NOW() - INTERVAL '1 minute')
  `;

  return rawToken;
}

/**
 * Stores a consumed reset-token hash and returns the raw secret for reuse tests.
 * @param userId - Account whose reset link has already been consumed.
 * @example await insertUsedResetToken(userId) // raw token rejected as already used
 */
export async function insertUsedResetToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await sql`
    INSERT INTO user_password_reset_tokens (user_id, token_hash, expires_at, used_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt}, NOW())
  `;

  return rawToken;
}

// ─── Cookie helper ───────────────────────────────────────────────────────────

/**
 * Reads a named cookie value from one or several Set-Cookie response headers.
 * @param name - Cookie name to match exactly; a missing cookie returns undefined.
 * @example extractCookie(response.headers, 'refreshToken') // raw refresh-cookie value
 */
export function extractCookie(headers: Record<string, unknown>, name: string): string | undefined {
  const setCookieHeaders = headers['set-cookie'];
  let cookies: string[] = [];
  if (Array.isArray(setCookieHeaders)) cookies = setCookieHeaders;
  else if (typeof setCookieHeaders === 'string') cookies = [setCookieHeaders];

  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? match.split(';')[0].split('=').slice(1).join('=') : undefined;
}

export { seedTestUser, deleteTestUser, sql };
