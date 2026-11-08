import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import escapeHtml from 'escape-html';
import { sql, asTransactionSql } from '../../db/client';
import { sendEmail, send2FACode } from '../../utils/emailService';
import { hashDeviceFingerprint } from '../../utils/deviceUtils';
import { revokeAccessToken } from './tokenRevocationService';
import { authLog as logAuthEvent } from './authLogService';
import { lockAccountUser } from '../accounts/accountService';
import type {
  UserCredentials,
  Users,
  UserRefreshTokens,
  UserPasswordResetTokens,
  UserTrustedDevices,
} from '../../types/database';
import type { DbRow } from '../../types/db';
import { requireEnv } from '../../utils/env';
import type { AccessTokenPayload, RefreshTokenPayload, UserRole, Permission } from '../../types/auth';
import {
  LockedError,
  UnauthorizedError,
  TooManyRequestsError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../errors';

const JWT_SECRET = requireEnv('JWT_SECRET');
const REFRESH_SECRET = requireEnv('REFRESH_SECRET');
const FRONTEND_URL = requireEnv('FRONTEND_URL');

// Security constants
const TRUSTED_DEVICE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const REFRESH_TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours
const REFRESH_TOKEN_EXPIRY = '8h';
const ACCESS_TOKEN_EXPIRY = '4h';
const AUTH_CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
// Generate dummy hash at startup for timing attack protection on invalid emails
const DUMMY_HASH = bcrypt.hashSync('dummy_password_for_timing_attack_protection', 10);

type LoginCredentialsRow =
  DbRow<Pick<UserCredentials, 'user_id' | 'email' | 'password_hash' | 'email_verified' | 'failed_login_attempts' | 'locked_until' | 'status'>> &
  DbRow<Pick<Users, 'first_name' | 'last_name'>> &
  { role: UserRole; permissions: Permission[] };

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
  | { type: 'requiresVerification'; userId: string }
  | { type: 'success'; tokens: TokenPair; user: UserInfo };

export interface VerifyResult {
  tokens: TokenPair;
  user: UserInfo;
}

/**
 * Checks the password and active account, then starts 2FA or returns a session for an accepted device.
 * Failed passwords update lockout state; email and persistence failures propagate.
 * @param email - Validated account address used to find credentials.
 * @param password - Raw password compared against the stored hash.
 * @param deviceFingerprint - Browser device identifier to compare with unexpired trusted-device records.
 * @returns A user ID awaiting verification, or the signed tokens and public user details.
 * @example loginUser('alex@example.org', password) // requiresVerification unless a device/bypass is accepted
 */
export async function loginUser(
  email: string,
  password: string,
  deviceFingerprint?: string,
  ipAddress?: string,
): Promise<LoginResult> {
  // 1. Load credentials, account status, role, and permissions.
  const credentials = await sql<LoginCredentialsRow[]>`
    SELECT
      credentials.user_id,
      credentials.email,
      credentials.password_hash,
      credentials.email_verified,
      credentials.failed_login_attempts,
      credentials.locked_until,
      credentials.status,

      account_user.first_name,
      account_user.last_name,

      role.name AS role,

      COALESCE(
        json_agg(permission.name) FILTER (WHERE permission.name IS NOT NULL),
        '[]'
      ) AS permissions
    FROM user_credentials credentials
    JOIN users account_user ON account_user.id = credentials.user_id
    JOIN user_roles role ON role.id = account_user.role_id
    LEFT JOIN user_role_has_permissions role_permission ON role_permission.role_id = role.id
    LEFT JOIN user_permissions permission ON permission.id = role_permission.permission_id
    WHERE credentials.email = ${email}
    GROUP BY credentials.user_id, credentials.email, credentials.password_hash, credentials.email_verified,
             credentials.failed_login_attempts, credentials.locked_until, credentials.status, account_user.first_name, account_user.last_name, role.name
    LIMIT 1
  `;

  // 2. Reject an account whose lockout is still active.
  if (credentials.length > 0) {
    const credential = credentials[0];

    if (credential.lockedUntil && new Date(credential.lockedUntil) > new Date()) {
      const minutesLeft = Math.ceil((new Date(credential.lockedUntil).getTime() - Date.now()) / 60000);
      throw new LockedError(`Account locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`);
    }

    // 3. Clear an expired lockout.
    if (credential.lockedUntil && new Date(credential.lockedUntil) <= new Date()) {
      await sql`
        UPDATE user_credentials
        SET failed_login_attempts = 0, locked_until = NULL
        WHERE user_id = ${credential.userId}
      `;
    }
  }

  // 4. Compare the password, using a dummy hash for unknown emails.
  const passwordHash = credentials.length > 0 ? credentials[0].passwordHash : DUMMY_HASH;
  const isValid = await bcrypt.compare(password, passwordHash);

  // 5. Record failed passwords and lock known accounts after five failures.
  if (credentials.length === 0 || !isValid) {
    if (credentials.length > 0) {
      const credential = credentials[0];
      const newFailedAttempts = (credential.failedLoginAttempts || 0) + 1;

      if (newFailedAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);

        await sql`
          UPDATE user_credentials
          SET failed_login_attempts = ${newFailedAttempts}, locked_until = ${lockUntil}
          WHERE user_id = ${credential.userId}
        `;
        await logAuthEvent({ event: 'account_locked', userId: credential.userId, email: credential.email, ipAddress, metadata: { lockedUntil: lockUntil.toISOString() } });
        throw new LockedError('Account locked due to too many failed attempts. Try again in 15 minutes.');
      } else {
        await sql`
          UPDATE user_credentials
          SET failed_login_attempts = ${newFailedAttempts}
          WHERE user_id = ${credential.userId}
        `;
        await logAuthEvent({ event: 'login_failure', userId: credential.userId, email: credential.email, ipAddress, metadata: { failedAttempts: newFailedAttempts } });
      }
    } else {
      await logAuthEvent({ event: 'login_failure', email, ipAddress });
    }
    throw new UnauthorizedError('Invalid email or password');
  }

  const credential = credentials[0];

  // 6. Clear failed attempts after a valid password.
  await sql`
    UPDATE user_credentials
    SET failed_login_attempts = 0, locked_until = NULL
    WHERE user_id = ${credential.userId}
  `;

  // 7. Require an active account.
  if (credential.status !== 'active') {
    throw new ForbiddenError('Account is deactivated');
  }

  // 8. Allow an explicit 2FA bypass only in local development.
  if (isTwoFactorDisabled()) {
    return completeLogin(credential, 'local_development', ipAddress);
  }

  // 9. Check for an unexpired trusted device before requiring 2FA.
  if (deviceFingerprint) {
    const deviceHash = hashDeviceFingerprint(deviceFingerprint);

    const trustedDevices = await sql<DbRow<UserTrustedDevices>[]>`
      SELECT *
      FROM user_trusted_devices
      WHERE user_id = ${credential.userId}
        AND device_hash = ${deviceHash}
        AND expires_at > NOW()
      LIMIT 1
    `;

    if (trustedDevices.length > 0) {
      return completeLogin(credential, 'trusted_device', ipAddress, deviceHash);
    }
  }

  // 10. Remove expired and used verification codes.
  await sql`
    DELETE
    FROM user_auth_codes
    WHERE user_id = ${credential.userId}
      AND (expires_at < NOW() OR used_at IS NOT NULL)
  `;

  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS);

  // 11. Save a fresh five-minute verification code.
  await sql`
    INSERT INTO user_auth_codes (user_id, code, expires_at)
    VALUES (${credential.userId}, ${code}, ${expiresAt})
  `;

  // 12. Send the code and record the verification request.
  await send2FACode(credential.email, code, credential.firstName);
  await logAuthEvent({ event: '2fa_sent', userId: credential.userId, email: credential.email, ipAddress });

  return { type: 'requiresVerification', userId: credential.userId };
}

/**
 * Consumes an unused verification code, checks current account status, and issues a session.
 * @param code - Emailed six-digit code for userId; expired/used codes are rejected.
 * @param trustDevice - Whether to store the supplied device fingerprint for 30 days.
 * @returns Signed tokens and current public user details; required persistence failures reject.
 * @example verify2FACode(userId, '123456', false) // session without registering a trusted device
 */
export async function verify2FACode(
  userId: string,
  code: string,
  trustDevice: boolean,
  deviceFingerprint?: string,
  deviceName?: string,
  ipAddress?: string,
): Promise<VerifyResult> {
  // 1. Count recent code issuance to enforce the verification limit.
  const recentAttempts = await sql<{ count: string }[]>`
    SELECT COUNT(*) as count
    FROM user_auth_codes
    WHERE user_id = ${userId}
      AND created_at > NOW() - INTERVAL '15 minutes'
  `;

  if (Number(recentAttempts[0]?.count) > 10) {
    throw new TooManyRequestsError('Too many verification attempts. Please try again later.');
  }

  // 2. Consume an unexpired, unused code atomically.
  const codes = await sql<DbRow<{ id: string }>[]>`
    UPDATE user_auth_codes
    SET used_at = NOW()
    WHERE user_id = ${userId}
      AND code = ${code}
      AND expires_at > NOW()
      AND used_at IS NULL
    RETURNING *
  `;

  if (codes.length === 0) {
    await logAuthEvent({ event: '2fa_failed', userId, ipAddress });
    throw new UnauthorizedError('Invalid or expired code');
  }

  // 3. Load current user details, status, role, and permissions.
  const credentials = await sql<LoginCredentialsRow[]>`
    SELECT
      credentials.user_id,
      credentials.email,
      credentials.status,

      account_user.first_name,
      account_user.last_name,

      role.name AS role,

      COALESCE(
        json_agg(permission.name) FILTER (WHERE permission.name IS NOT NULL),
        '[]'
      ) AS permissions
    FROM user_credentials credentials
    JOIN users account_user ON account_user.id = credentials.user_id
    JOIN user_roles role ON role.id = account_user.role_id
    LEFT JOIN user_role_has_permissions role_permission ON role_permission.role_id = role.id
    LEFT JOIN user_permissions permission ON permission.id = role_permission.permission_id
    WHERE credentials.user_id = ${userId}
    GROUP BY credentials.user_id, credentials.email, credentials.status, account_user.first_name, account_user.last_name, role.name
    LIMIT 1
  `;

  if (credentials.length === 0) {
    throw new NotFoundError('User not found');
  }

  const credential = credentials[0];
  if (credential.status !== 'active') {
    throw new ForbiddenError('Account is inactive');
  }

  if (trustDevice && deviceFingerprint) {
    const deviceHash = hashDeviceFingerprint(deviceFingerprint);
    const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_EXPIRY_MS);

    // 4. Find an existing trust record for the supplied device.
    const existingDevice = await sql<DbRow<{ id: string }>[]>`
      SELECT id
      FROM user_trusted_devices
      WHERE user_id = ${credential.userId}
        AND device_hash = ${deviceHash}
      LIMIT 1
    `;

    // 5. Renew or register the device's trust for 30 days.
    if (existingDevice.length > 0) {
      await sql`
        UPDATE user_trusted_devices
        SET expires_at = ${expiresAt}
        WHERE id = ${existingDevice[0].id}
      `;
    } else {
      await sql`
        INSERT INTO user_trusted_devices (user_id, device_hash, device_name, expires_at)
        VALUES (${credential.userId}, ${deviceHash}, ${deviceName || 'Unknown Device'}, ${expiresAt})
      `;
      await logAuthEvent({ event: 'trusted_device_added', userId: credential.userId, email: credential.email, ipAddress, metadata: { deviceName: deviceName || 'Unknown Device' } });
    }
  }

  // 6. Record the successful login time.
  await sql`
    UPDATE user_credentials
    SET last_login = NOW()
    WHERE user_id = ${credential.userId}
  `;

  // 7. Issue a token pair in a new session family.
  const tokens = await generateAndStoreTokenPair(
    credential.userId,
    credential.email,
    credential.role,
    credential.permissions,
    crypto.randomUUID(),
  );

  await logAuthEvent({ event: '2fa_verified', userId: credential.userId, email: credential.email, ipAddress });
  return {
    tokens,
    user: { id: credential.userId, firstName: credential.firstName, lastName: credential.lastName, email: credential.email },
  };
}

/**
 * Sends another verification code to an active account, allowing at most three requests in five minutes.
 * Missing/inactive accounts and rate limits reject; completion waits for email delivery.
 * @example await resend2FACode(userId) // sends a fresh five-minute code
 */
export async function resend2FACode(userId: string, ipAddress?: string): Promise<void> {
  // 1. Enforce at most three code requests in five minutes.
  const recentCodes = await sql<{ count: string }[]>`
    SELECT COUNT(*) as count
    FROM user_auth_codes
    WHERE user_id = ${userId}
      AND created_at > NOW() - INTERVAL '5 minutes'
  `;

  if (Number(recentCodes[0]?.count) >= 3) {
    throw new TooManyRequestsError('Too many code requests. Please wait before requesting another code.');
  }

  // 2. Load the recipient and require an active account.
  const credentials = await sql<(
    DbRow<Pick<UserCredentials, 'email' | 'status'>> &
    DbRow<Pick<Users, 'first_name'>>
  )[]>`
    SELECT
      credentials.email,
      credentials.status,

      account_user.first_name
    FROM user_credentials credentials
    JOIN users account_user ON account_user.id = credentials.user_id
    WHERE credentials.user_id = ${userId}
    LIMIT 1
  `;

  if (credentials.length === 0) {
    throw new NotFoundError('User not found');
  }

  const credential = credentials[0];
  if (credential.status !== 'active') {
    throw new ForbiddenError('Account is inactive');
  }

  // 3. Remove expired and used verification codes.
  await sql`
    DELETE
    FROM user_auth_codes
    WHERE user_id = ${userId}
      AND (expires_at < NOW() OR used_at IS NOT NULL)
  `;

  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS);

  // 4. Save a fresh five-minute verification code.
  await sql`
    INSERT INTO user_auth_codes (user_id, code, expires_at)
    VALUES (${userId}, ${code}, ${expiresAt})
  `;

  // 5. Send the replacement code and record the request.
  await send2FACode(credential.email, code, credential.firstName);
  await logAuthEvent({ event: '2fa_resent', userId, email: credential.email, ipAddress });
}

/**
 * Replaces a valid stored refresh token in its existing family and reloads role/permissions.
 * Reuse of a retained revoked token revokes its family; replacement writes commit together.
 * @param rawRefreshToken - Signed refresh-cookie value, never its stored hash.
 * @returns New access and refresh tokens; rejected credentials/tokens and persistence failures throw.
 * @example rotateRefreshToken(cookie) // replacement tokens with current permissions
 */
export async function rotateRefreshToken(
  rawRefreshToken: string,
  ipAddress?: string,
): Promise<{ newAccessToken: string; newRefreshToken: string }> {
  // 1. Verify the refresh token signature and identifier.
  let decoded: RefreshTokenPayload;
  try {
    decoded = jwt.verify(rawRefreshToken, REFRESH_SECRET) as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.NotBeforeError) {
      throw new ForbiddenError('Invalid refresh token');
    }
    throw error;
  }

  if (!decoded.jti) {
    throw new ForbiddenError('Invalid token format - please log in again');
  }

  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  // 2. Find a matching, unexpired, unrevoked refresh token.
  const storedTokens = await sql<DbRow<UserRefreshTokens>[]>`
    SELECT *
    FROM user_refresh_tokens
    WHERE jti = ${decoded.jti}
      AND token_hash = ${tokenHash}
      AND expires_at > NOW()
      AND revoked_at IS NULL
    LIMIT 1
  `;

  // 3. Look for a retained token family when the active token is missing.
  if (storedTokens.length === 0) {
    const familyTokens = await sql<DbRow<Pick<UserRefreshTokens, 'token_family'>>[]>`
      SELECT token_family
      FROM user_refresh_tokens WHERE jti = ${decoded.jti} LIMIT 1
    `;

    // 4. Revoke the token family when an old token is reused.
    if (familyTokens.length > 0) {
      await sql`
        UPDATE user_refresh_tokens
        SET revoked_at = NOW()
        WHERE token_family = ${familyTokens[0].tokenFamily}
      `;
      await logAuthEvent({ event: 'token_reuse_detected', userId: decoded.userId, email: decoded.email, ipAddress, metadata: { tokenFamily: familyTokens[0].tokenFamily } });
      throw new ForbiddenError('Token reuse detected - all sessions revoked');
    } else {
      throw new ForbiddenError('Invalid or expired refresh token');
    }
  }

  const storedToken = storedTokens[0];

  // 5. Reload account status, role, and permissions.
  const users = await sql<{ status: string; role: UserRole; permissions: Permission[] }[]>`
    SELECT
      credentials.status,

      role.name AS role,

      COALESCE(
        json_agg(permission.name) FILTER (WHERE permission.name IS NOT NULL),
        '[]'
      ) AS permissions
    FROM users account_user
    JOIN user_credentials credentials ON credentials.user_id = account_user.id
    JOIN user_roles role ON role.id = account_user.role_id
    LEFT JOIN user_role_has_permissions role_permission ON role_permission.role_id = role.id
    LEFT JOIN user_permissions permission ON permission.id = role_permission.permission_id
    WHERE account_user.id = ${decoded.userId}
    GROUP BY account_user.id, role.id, role.name, credentials.status
    LIMIT 1
  `;

  if (users.length === 0) {
    throw new ForbiddenError('User not found');
  }
  if (users[0].status !== 'active') {
    throw new ForbiddenError('Account is inactive');
  }

  // 6. Sign replacement access and refresh tokens.
  const newAccessJTI = generateJTI();
  const newRefreshJTI = generateJTI();

  const newAccessToken = signAccessToken({
    userId: decoded.userId,
    email: decoded.email,
    role: users[0].role,
    permissions: users[0].permissions,
    jti: newAccessJTI,
  });

  const newRefreshToken = signRefreshToken({
    userId: decoded.userId,
    email: decoded.email,
    jti: newRefreshJTI,
  });

  const newRefreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

  await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    // 7. Store the replacement refresh token in the same family.
    const newTokenRows = await trx<{ id: string }[]>`
      INSERT INTO user_refresh_tokens (user_id, jti, token_hash, token_family, expires_at)
      VALUES (${decoded.userId}, ${newRefreshJTI}, ${newTokenHash}, ${storedToken.tokenFamily}, ${newRefreshExpiresAt})
      RETURNING id
    `;

    // 8. Revoke the previous token in the same transaction.
    await trx`
      UPDATE user_refresh_tokens
      SET revoked_at = NOW(), replaced_by = ${newTokenRows[0].id}
      WHERE jti = ${decoded.jti}
    `;
  });

  return { newAccessToken, newRefreshToken };
}

/**
 * Issues a one-hour reset link for current credentials, then awaits email delivery after commit.
 * Missing or concurrently changed addresses return without sending email, preserving account privacy.
 * @example await requestPasswordReset('unknown@example.org') // resolves without revealing absence
 */
export async function requestPasswordReset(email: string, ipAddress?: string): Promise<void> {
  // 1. Find the account without revealing whether the address exists.
  const [account] = await sql<{ userId: string }[]>`
    SELECT user_id
    FROM user_credentials
    WHERE email = ${email}
    LIMIT 1
  `;

  if (!account) return;

  // 2. Prepare a one-hour reset token.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

  const credential = await sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 3. Lock the user while checking credentials and issuing the token.
    const accountExists = await lockAccountUser(trx, account.userId);
    if (!accountExists) return undefined;

    // 4. Recheck the address and credentials after acquiring the lock.
    const [current] = await trx<{ userId: string; email: string; firstName: string }[]>`
      SELECT
        credentials.user_id,
        credentials.email,

        account_user.first_name
      FROM user_credentials credentials
      JOIN users account_user ON account_user.id = credentials.user_id
      WHERE credentials.user_id = ${account.userId} AND credentials.email = ${email}
    `;
    if (!current) return undefined;

    // 5. Store the reset token for the current credentials.
    await trx`
      INSERT INTO user_password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${current.userId}, ${tokenHash}, ${expiresAt})
    `;
    return current;
  });
  if (!credential) return;

  // 6. Build the reset email with an escaped recipient name.
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;
  const safeFirstName = escapeHtml(credential.firstName);
  const emailHtml = `
    <h2>Password Reset Request</h2>
    <p>Hi ${safeFirstName},</p>
    <p>You requested to reset your password. Click the link below to reset it:</p>
    <a href="${resetUrl}">Reset Password</a>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  // 7. Send the email and record the request after commit.
  await sendEmail(credential.email, 'Password Reset Request', emailHtml);
  await logAuthEvent({ event: 'password_reset_requested', userId: credential.userId, email: credential.email, ipAddress });
}

/**
 * Consumes a valid reset link under the account lock, sets its password, and revokes refresh sessions.
 * Invited credentials become active; other statuses stay unchanged. Missing credentials or stale links are 400.
 * @param rawToken - Raw emailed secret; only its hash is queried/stored.
 * @param newPassword - Validated replacement password, hashed before acquiring transaction locks.
 * @example await resetUserPassword(invitationToken, password) // activates that invitation once
 */
export async function resetUserPassword(rawToken: string, newPassword: string, ipAddress?: string): Promise<void> {
  // 1. Hash the token and replacement password before acquiring database locks.
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const resetUserId = await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    // 2. Find an unexpired, unused reset token.
    const [candidate] = await trx<DbRow<Pick<UserPasswordResetTokens, 'id' | 'user_id'>>[]>`
      SELECT id, user_id
      FROM user_password_reset_tokens
      WHERE token_hash = ${tokenHash} AND expires_at > NOW() AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!candidate) throw new BadRequestError('Invalid or expired reset token');

    // 3. Lock the user so revocation and password reset run in sequence.
    const accountExists = await lockAccountUser(trx, candidate.userId);
    if (!accountExists) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // 4. Claim the token only if it remains valid after the lock wait.
    const consumedTokens = await trx<{ userId: string }[]>`
      UPDATE user_password_reset_tokens
      SET used_at = NOW()
      WHERE id = ${candidate.id} AND token_hash = ${tokenHash}
        AND expires_at > NOW() AND used_at IS NULL
      RETURNING user_id
    `;

    if (consumedTokens.length === 0) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // 5. Save the password and activate invited credentials.
    const updated = await trx<{ userId: string }[]>`
      UPDATE user_credentials
      SET password_hash = ${passwordHash},
          status = CASE
            WHEN status = 'invited' THEN 'active'
            ELSE status
          END,
          updated_at = NOW()
      WHERE user_id = ${candidate.userId}
      RETURNING user_id
    `;
    if (!updated.length) throw new BadRequestError('Invalid or expired reset token');

    // 6. Revoke existing refresh sessions in the same transaction.
    await trx`
      UPDATE user_refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = ${candidate.userId} AND revoked_at IS NULL
    `;
    return candidate.userId;
  });

  // 7. Record the completed reset after commit.
  await logAuthEvent({ event: 'password_reset_completed', userId: resetUserId, ipAddress });
}

/**
 * Revokes either supplied session token and records logout; expired/invalid token strings are tolerated.
 * Revocation persistence failures reject, while security logging remains best effort.
 * @example await logoutUser(refreshCookie, bearerToken) // revokes both independently
 */
export async function logoutUser(rawRefreshToken?: string, rawAccessToken?: string, ipAddress?: string): Promise<void> {
  let logUserId: string | undefined;
  let logEmail: string | undefined;

  // 1. Verify the supplied refresh token, tolerating invalid or expired values.
  const refresh = rawRefreshToken
    ? verifyLogoutToken<RefreshTokenPayload>(rawRefreshToken, REFRESH_SECRET)
    : undefined;
  if (refresh) {
    logUserId = refresh.userId;
    logEmail = refresh.email;

    // 2. Revoke the refresh token when valid.
    await sql`
      UPDATE user_refresh_tokens
      SET revoked_at = NOW()
      WHERE jti = ${refresh.jti}
    `;
  }

  // 3. Independently verify the supplied access token.
  const access = rawAccessToken
    ? verifyLogoutToken<AccessTokenPayload>(rawAccessToken, JWT_SECRET)
    : undefined;
  if (access && rawAccessToken) {
    logUserId ??= access.userId;
    logEmail ??= access.email;
    const tokenHash = crypto.createHash('sha256').update(rawAccessToken).digest('hex');
    const expiresAt = new Date(access.exp * 1000);

    // 4. Persist access-token revocation and update the local revocation cache.
    await revokeAccessToken(access.jti, access.userId, tokenHash, expiresAt);
  }

  // 5. Record logout after the supplied tokens have been handled.
  await logAuthEvent({ event: 'logout', userId: logUserId, email: logEmail, ipAddress });
}

/**
 * Completes an already verified active login, updating last-login time and issuing a new token family.
 * @param credential - Current account details after password, active-status, and device checks.
 * @param method - Accepted local bypass or trusted-device path recorded in the security log.
 * @example completeLogin(credentials, 'trusted_device') // success with tokens and public user details
 */
async function completeLogin(
  credential: LoginCredentialsRow,
  method: 'local_development' | 'trusted_device',
  ipAddress?: string,
  deviceFingerprintHash?: string,
): Promise<LoginResult> {
  // 1. Record the successful login time.
  await sql`
    UPDATE user_credentials
    SET last_login = NOW()
    WHERE user_id = ${credential.userId}
  `;

  // 2. Issue a token pair in a new session family.
  const tokens = await generateAndStoreTokenPair(
    credential.userId,
    credential.email,
    credential.role,
    credential.permissions,
    crypto.randomUUID(),
  );

  // 3. Record the accepted login method.
  await logAuthEvent({
    event: 'login_success',
    userId: credential.userId,
    email: credential.email,
    ipAddress,
    deviceFingerprintHash,
    metadata: { method },
  });

  return {
    type: 'success',
    tokens,
    user: {
      id: credential.userId,
      firstName: credential.firstName,
      lastName: credential.lastName,
      email: credential.email,
    },
  };
}

/**
 * Signs a token pair and stores the refresh hash, family, and eight-hour expiry before returning.
 * @param userId - Account receiving the new session.
 * @param email - Current account address embedded in both tokens.
 * @param role - Current role embedded in the access token.
 * @param permissions - Current capabilities embedded in the access token.
 * @param tokenFamily - Logical session identifier shared by its successive refresh tokens.
 * @example generateAndStoreTokenPair(userId, email, role, permissions, family) // raw token pair
 */
async function generateAndStoreTokenPair(
  userId: string,
  email: string,
  role: UserRole,
  permissions: Permission[],
  tokenFamily: string,
): Promise<TokenPair> {
  // 1. Sign access and refresh tokens with separate identifiers.
  const accessJTI = generateJTI();
  const refreshJTI = generateJTI();

  const accessToken = signAccessToken({ userId, email, role, permissions, jti: accessJTI });

  const refreshToken = signRefreshToken({ userId, email, jti: refreshJTI });

  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  // 2. Store the refresh token hash, family, and expiry.
  await sql`
    INSERT INTO user_refresh_tokens (user_id, jti, token_hash, token_family, expires_at)
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

/**
 * Allows the explicit 2FA bypass only in local development.
 * @example NODE_ENV='test' with DISABLE_2FA='true' still returns false.
 */
function isTwoFactorDisabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.DISABLE_2FA === 'true';
}

/**
 * Creates a cryptographically random 32-character hex token identifier.
 * @example generateJTI() // a fresh identifier for one access or refresh token
 */
function generateJTI(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Signs identity, role, permissions and JTI as a four-hour access token.
 * @example signAccessToken(claims) // JWT with tokenType: 'access'
 */
function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'tokenType'>): string {
  return jwt.sign({ ...payload, tokenType: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Signs supplied refresh claims with an eight-hour expiry and the refresh discriminator.
 * @example signRefreshToken(claims) // JWT with tokenType: 'refresh'
 */
function signRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp' | 'tokenType'>): string {
  return jwt.sign({ ...payload, tokenType: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

/**
 * Verifies a logout token, tolerating only expected invalid or expired tokens.
 * Persistence stays outside this helper so failures cannot become logout success.
 * @example verifyLogoutToken<AccessTokenPayload>('expired-token', JWT_SECRET) // undefined
 */
function verifyLogoutToken<T extends AccessTokenPayload | RefreshTokenPayload>(rawToken: string, secret: string): T | undefined {
  try {
    return jwt.verify(rawToken, secret) as T;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.NotBeforeError) return undefined;
    throw error;
  }
}
