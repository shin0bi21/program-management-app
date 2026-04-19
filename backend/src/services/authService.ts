import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sql } from '../db/client';
import { sendEmail, send2FACode } from '../utils/emailService';
import { hashDeviceFingerprint } from '../utils/deviceUtils';
import { blacklistCache } from '../middleware/authMiddleware';
import type {
  UserCredentials,
  Users,
  RefreshTokens,
  PasswordResetTokens,
  TrustedDevices,
} from '../types/database';
import type { DbRow } from '../types/db';

function requireEnv(name: 'JWT_SECRET' | 'REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set before the auth service starts`);
  }
  return value;
}

const JWT_SECRET = requireEnv('JWT_SECRET');
const REFRESH_SECRET = requireEnv('REFRESH_SECRET');

// Security constants
const TRUSTED_DEVICE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours
const REFRESH_TOKEN_EXPIRY = '8h';
const ACCESS_TOKEN_EXPIRY = '1h';
const AUTH_CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Generate dummy hash at startup for timing attack protection on invalid emails
const DUMMY_HASH = bcrypt.hashSync('dummy_password_for_timing_attack_protection', 10);

// ============================================================================
// TYPES
// ============================================================================

type LoginCredentialsRow =
  DbRow<Pick<UserCredentials, 'user_id' | 'email' | 'password_hash' | 'email_verified' | 'failed_login_attempts' | 'locked_until'>> &
  DbRow<Pick<Users, 'first_name' | 'last_name' | 'permission'>>;

export interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type LoginResult =
  | { type: 'requires2FA'; userId: string }
  | { type: 'success'; tokens: TokenPair; user: UserInfo };

export interface VerifyResult {
  tokens: TokenPair;
  user: UserInfo;
}

export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

function generateJTI(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Signs a new access + refresh token pair and persists the refresh token.
 * Used in: loginUser (trusted device), verify2FACode, rotateRefreshToken.
 */
async function generateAndStoreTokenPair(
  userId: string,
  email: string,
  permission: string,
  tokenFamily: string,
): Promise<TokenPair> {
  const accessJTI = generateJTI();
  const refreshJTI = generateJTI();

  const accessToken = jwt.sign(
    { userId, email, permission, jti: accessJTI },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );

  const refreshToken = jwt.sign(
    { userId, email, jti: refreshJTI },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY },
  );

  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await sql`
    INSERT INTO refresh_tokens (user_id, jti, token_hash, token_family, expires_at)
    VALUES (
      ${userId},
      ${refreshJTI},
      ${crypto.createHash('sha256').update(refreshToken).digest('hex')},
      ${tokenFamily},
      ${refreshExpiresAt}
    )
  `;

  return { accessToken, refreshToken };
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

export async function loginUser(
  email: string,
  password: string,
  deviceFingerprint?: string,
): Promise<LoginResult> {
  // 1. Fetch credentials
  const credentials = await sql<LoginCredentialsRow[]>`
    SELECT
      uc.user_id,
      uc.email,
      uc.password_hash,
      uc.email_verified,
      uc.failed_login_attempts,
      uc.locked_until,
      u.first_name,
      u.last_name,
      u.permission
    FROM user_credentials uc
    JOIN users u ON u.id = uc.user_id
    WHERE uc.email = ${email}
    LIMIT 1
  `;

  // 2. Check / clear account lockout
  if (credentials.length > 0) {
    const cred = credentials[0];

    if (cred.lockedUntil && new Date(cred.lockedUntil) > new Date()) {
      const minutesLeft = Math.ceil((new Date(cred.lockedUntil).getTime() - Date.now()) / 60000);
      throw new AuthError(423, `Account locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`);
    }

    if (cred.lockedUntil && new Date(cred.lockedUntil) <= new Date()) {
      await sql`
        UPDATE user_credentials
        SET failed_login_attempts = 0, locked_until = NULL
        WHERE user_id = ${cred.userId}
      `;
    }
  }

  // 3. Compare password (always hash to prevent timing attacks on unknown emails)
  const passwordHash = credentials.length > 0 ? credentials[0].passwordHash : DUMMY_HASH;
  const isValid = await bcrypt.compare(password, passwordHash);

  if (credentials.length === 0 || !isValid) {
    if (credentials.length > 0) {
      const cred = credentials[0];
      const newFailedAttempts = (cred.failedLoginAttempts || 0) + 1;

      if (newFailedAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await sql`
          UPDATE user_credentials
          SET failed_login_attempts = ${newFailedAttempts}, locked_until = ${lockUntil}
          WHERE user_id = ${cred.userId}
        `;
        throw new AuthError(423, 'Account locked due to too many failed attempts. Try again in 15 minutes.');
      } else {
        await sql`
          UPDATE user_credentials
          SET failed_login_attempts = ${newFailedAttempts}
          WHERE user_id = ${cred.userId}
        `;
      }
    }
    throw new AuthError(401, 'Invalid email or password');
  }

  const cred = credentials[0];

  // 4. Reset failed attempts on success
  await sql`
    UPDATE user_credentials
    SET failed_login_attempts = 0, locked_until = NULL
    WHERE user_id = ${cred.userId}
  `;

  // 5. Check trusted device — skip 2FA if device is known
  if (deviceFingerprint) {
    const deviceHash = hashDeviceFingerprint(deviceFingerprint);

    const trustedDevices = await sql<DbRow<TrustedDevices>[]>`
      SELECT * FROM trusted_devices
      WHERE user_id = ${cred.userId}
        AND device_hash = ${deviceHash}
        AND expires_at > NOW()
      LIMIT 1
    `;

    if (trustedDevices.length > 0) {
      await sql`
        UPDATE user_credentials SET last_login = NOW() WHERE user_id = ${cred.userId}
      `;

      const tokens = await generateAndStoreTokenPair(
        cred.userId,
        cred.email,
        cred.permission,
        crypto.randomUUID(),
      );

      return {
        type: 'success',
        tokens,
        user: { id: cred.userId, firstName: cred.firstName, lastName: cred.lastName, email: cred.email },
      };
    }
  }

  // 6. Require 2FA — clean up stale codes, issue new one, send email
  await sql`
    DELETE FROM auth_codes
    WHERE user_id = ${cred.userId}
      AND (expires_at < NOW() OR used_at IS NOT NULL)
  `;

  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS);

  await sql`
    INSERT INTO auth_codes (user_id, code, expires_at)
    VALUES (${cred.userId}, ${code}, ${expiresAt})
  `;

  await send2FACode(cred.email, code, cred.firstName);

  return { type: 'requires2FA', userId: cred.userId };
}

export async function verify2FACode(
  userId: string,
  code: string,
  trustDevice: boolean,
  deviceFingerprint?: string,
  deviceName?: string,
): Promise<VerifyResult> {
  // 1. Rate limit verification attempts
  const recentAttempts = await sql<{ count: string }[]>`
    SELECT COUNT(*) as count
    FROM auth_codes
    WHERE user_id = ${userId}
      AND created_at > NOW() - INTERVAL '15 minutes'
  `;

  if (Number(recentAttempts[0]?.count) > 10) {
    throw new AuthError(429, 'Too many verification attempts. Please try again later.');
  }

  // 2. Atomically mark code as used (prevents race conditions)
  const codes = await sql<DbRow<{ id: string }>[]>`
    UPDATE auth_codes
    SET used_at = NOW()
    WHERE user_id = ${userId}
      AND code = ${code}
      AND expires_at > NOW()
      AND used_at IS NULL
    RETURNING *
  `;

  if (codes.length === 0) {
    throw new AuthError(401, 'Invalid or expired code');
  }

  // 3. Fetch user details
  const credentials = await sql<LoginCredentialsRow[]>`
    SELECT
      uc.user_id,
      uc.email,
      u.first_name,
      u.last_name,
      u.permission
    FROM user_credentials uc
    JOIN users u ON u.id = uc.user_id
    WHERE uc.user_id = ${userId}
    LIMIT 1
  `;

  if (credentials.length === 0) {
    throw new AuthError(404, 'User not found');
  }

  const cred = credentials[0];

  // 4. Trust device if requested
  if (trustDevice && deviceFingerprint) {
    const deviceHash = hashDeviceFingerprint(deviceFingerprint);
    const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_EXPIRY_MS);

    const existingDevice = await sql<DbRow<{ id: string }>[]>`
      SELECT id FROM trusted_devices
      WHERE user_id = ${cred.userId}
        AND device_hash = ${deviceHash}
      LIMIT 1
    `;

    if (existingDevice.length > 0) {
      await sql`
        UPDATE trusted_devices SET expires_at = ${expiresAt} WHERE id = ${existingDevice[0].id}
      `;
    } else {
      await sql`
        INSERT INTO trusted_devices (user_id, device_hash, device_name, expires_at)
        VALUES (${cred.userId}, ${deviceHash}, ${deviceName || 'Unknown Device'}, ${expiresAt})
      `;
    }
  }

  // 5. Record login timestamp
  await sql`
    UPDATE user_credentials SET last_login = NOW() WHERE user_id = ${cred.userId}
  `;

  // 6. Issue tokens
  const tokens = await generateAndStoreTokenPair(
    cred.userId,
    cred.email,
    cred.permission,
    crypto.randomUUID(),
  );

  return {
    tokens,
    user: { id: cred.userId, firstName: cred.firstName, lastName: cred.lastName, email: cred.email },
  };
}

export async function resend2FACode(userId: string): Promise<void> {
  // 1. Rate limit — max 3 codes in 5 minutes
  const recentCodes = await sql<{ count: string }[]>`
    SELECT COUNT(*) as count
    FROM auth_codes
    WHERE user_id = ${userId}
      AND created_at > NOW() - INTERVAL '5 minutes'
  `;

  if (Number(recentCodes[0]?.count) >= 3) {
    throw new AuthError(429, 'Too many code requests. Please wait before requesting another code.');
  }

  // 2. Fetch user details
  const credentials = await sql<(
    DbRow<Pick<UserCredentials, 'email'>> &
    DbRow<Pick<Users, 'first_name'>>
  )[]>`
    SELECT uc.email, u.first_name
    FROM user_credentials uc
    JOIN users u ON u.id = uc.user_id
    WHERE uc.user_id = ${userId}
    LIMIT 1
  `;

  if (credentials.length === 0) {
    throw new AuthError(404, 'User not found');
  }

  const cred = credentials[0];

  // 3. Clean up stale codes, insert new one
  await sql`
    DELETE FROM auth_codes
    WHERE user_id = ${userId}
      AND (expires_at < NOW() OR used_at IS NOT NULL)
  `;

  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS);

  await sql`
    INSERT INTO auth_codes (user_id, code, expires_at)
    VALUES (${userId}, ${code}, ${expiresAt})
  `;

  await send2FACode(cred.email, code, cred.firstName);
}

export async function rotateRefreshToken(
  rawRefreshToken: string,
): Promise<{ newAccessToken: string; newRefreshToken: string }> {
  let decoded: any;
  try {
    decoded = jwt.verify(rawRefreshToken, REFRESH_SECRET);
  } catch {
    throw new AuthError(403, 'Invalid refresh token');
  }

  if (!decoded.jti) {
    throw new AuthError(403, 'Invalid token format - please log in again');
  }

  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  // 1. Validate token exists, hasn't expired, and hasn't been revoked
  const storedTokens = await sql<DbRow<RefreshTokens>[]>`
    SELECT * FROM refresh_tokens
    WHERE jti = ${decoded.jti}
      AND token_hash = ${tokenHash}
      AND expires_at > NOW()
      AND revoked_at IS NULL
    LIMIT 1
  `;

  if (storedTokens.length === 0) {
    // Token reuse detected — revoke entire family
    const familyTokens = await sql<DbRow<Pick<RefreshTokens, 'token_family'>>[]>`
      SELECT token_family FROM refresh_tokens WHERE jti = ${decoded.jti} LIMIT 1
    `;

    if (familyTokens.length > 0) {
      await sql`
        UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_family = ${familyTokens[0].tokenFamily}
      `;
      throw new AuthError(403, 'Token reuse detected - all sessions revoked');
    } else {
      throw new AuthError(403, 'Invalid or expired refresh token');
    }
  }

  const storedToken = storedTokens[0];

  // 2. Get fresh user data (permission may have changed)
  const users = await sql<DbRow<Pick<Users, 'permission'>>[]>`
    SELECT permission FROM users WHERE id = ${decoded.userId} LIMIT 1
  `;

  if (users.length === 0) {
    throw new AuthError(403, 'User not found');
  }

  // 3. Generate new token pair in the same family
  const newAccessJTI = generateJTI();
  const newRefreshJTI = generateJTI();

  const newAccessToken = jwt.sign(
    { userId: decoded.userId, email: decoded.email, permission: users[0].permission, jti: newAccessJTI },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );

  const newRefreshToken = jwt.sign(
    { userId: decoded.userId, email: decoded.email, jti: newRefreshJTI },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY },
  );

  const newRefreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

  // 4. Insert new token, revoke old one, link via replaced_by
  const newTokenRows = await sql<{ id: string }[]>`
    INSERT INTO refresh_tokens (user_id, jti, token_hash, token_family, expires_at)
    VALUES (${decoded.userId}, ${newRefreshJTI}, ${newTokenHash}, ${storedToken.tokenFamily}, ${newRefreshExpiresAt})
    RETURNING id
  `;

  await sql`
    UPDATE refresh_tokens
    SET revoked_at = NOW(), replaced_by = ${newTokenRows[0].id}
    WHERE jti = ${decoded.jti}
  `;

  return { newAccessToken, newRefreshToken };
}

export async function logoutUser(rawRefreshToken?: string, rawAccessToken?: string): Promise<void> {
  if (rawRefreshToken) {
    try {
      const decoded = jwt.verify(rawRefreshToken, REFRESH_SECRET) as any;
      await sql`
        UPDATE refresh_tokens SET revoked_at = NOW() WHERE jti = ${decoded.jti}
      `;
    } catch {
      // Token already expired or invalid — still proceed with access token cleanup
    }
  }

  if (rawAccessToken) {
    try {
      const decoded = jwt.verify(rawAccessToken, JWT_SECRET) as any;
      const tokenHash = crypto.createHash('sha256').update(rawAccessToken).digest('hex');
      const expiresAt = new Date(decoded.exp * 1000);

      await sql`
        INSERT INTO token_blacklist (jti, user_id, token_hash, expires_at, reason)
        VALUES (${decoded.jti}, ${decoded.userId}, ${tokenHash}, ${expiresAt}, 'logout')
        ON CONFLICT (jti) DO NOTHING
      `;

      if (decoded.jti) {
        blacklistCache.add(decoded.jti);
      }
    } catch {
      // Token already expired or invalid — nothing to blacklist
    }
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const credentials = await sql<(
    DbRow<Pick<UserCredentials, 'user_id' | 'email'>> &
    DbRow<Pick<Users, 'first_name'>>
  )[]>`
    SELECT uc.user_id, uc.email, u.first_name
    FROM user_credentials uc
    JOIN users u ON u.id = uc.user_id
    WHERE uc.email = ${email}
    LIMIT 1
  `;

  // Security: always return success — don't reveal whether email exists
  if (credentials.length === 0) return;

  const cred = credentials[0];

  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

  await sql`
    INSERT INTO password_reset_tokens (user_id, token, expires_at)
    VALUES (${cred.userId}, ${tokenHash}, ${expiresAt})
  `;

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  const emailHtml = `
    <h2>Password Reset Request</h2>
    <p>Hi ${cred.firstName},</p>
    <p>You requested to reset your password. Click the link below to reset it:</p>
    <a href="${resetUrl}">Reset Password</a>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  await sendEmail(cred.email, 'Password Reset Request', emailHtml);
}

export async function resetUserPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const tokens = await sql<DbRow<PasswordResetTokens>[]>`
    SELECT * FROM password_reset_tokens
    WHERE token = ${tokenHash}
      AND expires_at > NOW()
      AND used_at IS NULL
    LIMIT 1
  `;

  if (tokens.length === 0) {
    throw new AuthError(400, 'Invalid or expired reset token');
  }

  const resetToken = tokens[0];
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await sql`UPDATE user_credentials SET password_hash = ${passwordHash} WHERE user_id = ${resetToken.userId}`;
  await sql`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ${resetToken.userId} AND revoked_at IS NULL`;
  await sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ${resetToken.id}`;
}
