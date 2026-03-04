import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sql } from '../db/client';
import { sendEmail, send2FACode } from '../utils/emailService';
import { hashDeviceFingerprint } from '../utils/deviceUtils';
import type {
  UserCredentials,
  Users,
  RefreshTokens,
  PasswordResetTokens,
  TrustedDevices
} from '../types/database';
import type { DbRow } from '../types/db';
import { blacklistCache } from '../middleware/authMiddleware';

const JWT_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.REFRESH_SECRET || JWT_SECRET + '_refresh';

// Helper to generate JTI
const generateJTI = () => crypto.randomBytes(16).toString('hex');

// Security constants
const TRUSTED_DEVICE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours
const REFRESH_TOKEN_EXPIRY = '8h';
const ACCESS_TOKEN_EXPIRY = '1h';
const AUTH_CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
// Generate dummy hash at startup for timing attack protection
const DUMMY_HASH = bcrypt.hashSync('dummy_password_for_timing_attack_protection', 10);

type LoginCredentialsRow =
  DbRow<Pick<UserCredentials, 'user_id' | 'email' | 'password_hash' | 'email_verified' | 'failed_login_attempts' | 'locked_until'>> &
  DbRow<Pick<Users, 'first_name' | 'last_name' | 'permission'>>;

export const login = async (req: Request, res: Response) => {
  const { email, password, deviceFingerprint } = req.body;

  try {
    // 1. Find user credentials by email
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

    // 2. Check if account is locked
    if (credentials.length > 0) {
      const cred = credentials[0];
      
      // Check if account is currently locked
      if (cred.lockedUntil && new Date(cred.lockedUntil) > new Date()) {
        const minutesLeft = Math.ceil((new Date(cred.lockedUntil).getTime() - Date.now()) / 60000);
        return res.status(423).json({ 
          error: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minutes.` 
        });
      }

      // Reset failed attempts if lock period has expired
      if (cred.lockedUntil && new Date(cred.lockedUntil) <= new Date()) {
        await sql`
          UPDATE user_credentials
          SET failed_login_attempts = 0, locked_until = NULL
          WHERE user_id = ${cred.userId}
        `;
      }
    }

    // 3. Compare Password (always hash to prevent timing attacks)
    const passwordHash = credentials.length > 0 ? credentials[0].passwordHash : DUMMY_HASH;
    const isValid = await bcrypt.compare(password, passwordHash);

    if (credentials.length === 0 || !isValid) {
      // Increment failed login attempts
      if (credentials.length > 0) {
        const cred = credentials[0];
        const newFailedAttempts = (cred.failedLoginAttempts || 0) + 1;
        
        // Lock account after 5 failed attempts for 15 minutes
        if (newFailedAttempts >= 5) {
          const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
          await sql`
            UPDATE user_credentials
            SET failed_login_attempts = ${newFailedAttempts},
                locked_until = ${lockUntil}
            WHERE user_id = ${cred.userId}
          `;
          return res.status(423).json({ 
            error: 'Account locked due to too many failed attempts. Try again in 15 minutes.' 
          });
        } else {
          await sql`
            UPDATE user_credentials
            SET failed_login_attempts = ${newFailedAttempts}
            WHERE user_id = ${cred.userId}
          `;
        }
      }
      
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const cred = credentials[0];

    // 4. Reset failed login attempts on successful login
    await sql`
      UPDATE user_credentials
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE user_id = ${cred.userId}
    `;

    // 5. Check if device is trusted (skip 2FA if trusted and not expired)
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
        // Device is trusted - skip 2FA and log in directly
        await sql`
          UPDATE user_credentials 
          SET last_login = NOW() 
          WHERE user_id = ${cred.userId}
        `;

        // Generate JTI for tokens
        const accessJTI = generateJTI();
        const refreshJTI = generateJTI();
        const tokenFamily = crypto.randomUUID();

        // Generate Access Token with JTI
        const accessToken = jwt.sign(
          { userId: cred.userId, email: cred.email, permission: cred.permission, jti: accessJTI },
          JWT_SECRET,
          { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        // Generate Refresh Token with JTI
        const refreshToken = jwt.sign(
          { userId: cred.userId, email: cred.email, jti: refreshJTI },
          REFRESH_SECRET,
          { expiresIn: REFRESH_TOKEN_EXPIRY }
        );

        // Store refresh token in database
        const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
        await sql`
          INSERT INTO refresh_tokens (
            user_id, jti, token_hash, token_family, expires_at
          ) VALUES (
            ${cred.userId},
            ${refreshJTI},
            ${crypto.createHash('sha256').update(refreshToken).digest('hex')},
            ${tokenFamily},
            ${refreshExpiresAt}
          )
        `;

        // Set refresh token in httpOnly cookie
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: REFRESH_TOKEN_EXPIRY_MS
        });

        return res.json({
          message: 'Login successful (trusted device)',
          token: accessToken,
          user: {
            id: cred.userId,
            firstName: cred.firstName,
            lastName: cred.lastName,
            email: cred.email,
          }
        });
      }
    }

    // 4. Cleanup old/expired codes
    await sql`
      DELETE FROM auth_codes 
      WHERE user_id = ${cred.userId}
        AND (expires_at < NOW() OR used_at IS NOT NULL)
    `;

    // 5. Generate 6-digit 2FA code (cryptographically secure)
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS);

    // 6. Store 2FA code in database
    await sql`
      INSERT INTO auth_codes (user_id, code, expires_at)
      VALUES (${cred.userId}, ${code}, ${expiresAt})
    `;

    // 7. Send 2FA code via email
    await send2FACode(cred.email, code, cred.firstName);

    // 8. Return pending status (don't log in yet)
    res.json({
      message: '2FA code sent to your email',
      requires2FA: true,
      userId: cred.userId // Frontend needs this for verification
    });

  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Login error:', error);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token not found' });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as any;
    
    // If token doesn't have JTI, it's an old token - reject it
    if (!decoded.jti) {
      res.clearCookie('refreshToken');
      return res.status(403).json({ error: 'Invalid token format - please log in again' });
    }
    
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Check if token exists and isn't revoked
    const storedTokens = await sql<DbRow<RefreshTokens>[]>`
      SELECT * FROM refresh_tokens
      WHERE jti = ${decoded.jti}
        AND token_hash = ${tokenHash}
        AND expires_at > NOW()
        AND revoked_at IS NULL
      LIMIT 1
    `;

    if (storedTokens.length === 0) {
      // Token reuse detected - try to revoke entire token family
      const familyTokens = await sql<DbRow<Pick<RefreshTokens, 'token_family'>>[]>`
        SELECT token_family FROM refresh_tokens
        WHERE jti = ${decoded.jti}
        LIMIT 1
      `;

      if (familyTokens.length > 0) {
        // Family found - revoke all tokens in family
        await sql`
          UPDATE refresh_tokens
          SET revoked_at = NOW()
          WHERE token_family = ${familyTokens[0].tokenFamily}
        `;
        return res.status(403).json({ error: 'Token reuse detected - all sessions revoked' });
      } else {
        // Token already pruned or never existed - still reject
        return res.status(403).json({ error: 'Invalid or expired refresh token' });
      }
    }

    const storedToken = storedTokens[0];

    // Get fresh user data including permission
    const users = await sql<DbRow<Pick<Users, 'permission'>>[]>`
      SELECT permission FROM users WHERE id = ${decoded.userId} LIMIT 1
    `;

    if (users.length === 0) {
      return res.status(403).json({ error: 'User not found' });
    }

    // Generate new tokens with new JTIs
    const newAccessJTI = generateJTI();
    const newRefreshJTI = generateJTI();

    const newAccessToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email, permission: users[0].permission, jti: newAccessJTI },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const newRefreshToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email, jti: newRefreshJTI },
      REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    // Revoke old refresh token and create new one
    const newRefreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    // Insert new token first to get its id
    const newTokenRows = await sql<{ id: string }[]>`
      INSERT INTO refresh_tokens (
        user_id, jti, token_hash, token_family, expires_at
      ) VALUES (
        ${decoded.userId},
        ${newRefreshJTI},
        ${newTokenHash},
        ${storedToken.tokenFamily},
        ${newRefreshExpiresAt}
      )
      RETURNING id
    `;

    // Mark old token as replaced with new token's id (not JTI)
    await sql`
      UPDATE refresh_tokens
      SET revoked_at = NOW(),
          replaced_by = ${newTokenRows[0].id}
      WHERE jti = ${decoded.jti}
    `;

    // Set new refresh token in cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_EXPIRY_MS
    });

    res.json({ token: newAccessToken });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Refresh token error:', error);
    }
    res.status(403).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  const authHeader = req.headers['authorization'];
  const accessToken = authHeader && authHeader.split(' ')[1];

  try {
    // Revoke refresh token if present
    if (refreshToken) {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as any;
      await sql`
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE jti = ${decoded.jti}
      `;
    }

    // Blacklist access token if present
    if (accessToken) {
      const decoded = jwt.verify(accessToken, JWT_SECRET) as any;
      const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
      const expiresAt = new Date(decoded.exp * 1000); // JWT exp is in seconds

      await sql`
        INSERT INTO token_blacklist (
          jti, user_id, token_hash, expires_at, reason
        ) VALUES (
          ${decoded.jti},
          ${decoded.userId},
          ${tokenHash},
          ${expiresAt},
          'logout'
        )
        ON CONFLICT (jti) DO NOTHING
      `;
      
      // Add to in-memory cache immediately
      if (decoded.jti) {
        blacklistCache.add(decoded.jti);
      }
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    // Even if token verification fails, clear cookie and return success
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  }
};

export const verify2FA = async (req: Request, res: Response) => {
  const { userId, code, trustDevice, deviceFingerprint, deviceName } = req.body;

  try {
    // 1. Rate limiting - check for too many verification attempts
    const recentAttempts = await sql<{ count: string }[]>`
      SELECT COUNT(*) as count
      FROM auth_codes
      WHERE user_id = ${userId}
        AND created_at > NOW() - INTERVAL '15 minutes'
    `;

    if (Number(recentAttempts[0]?.count) > 10) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
    }

    // 2. Atomically mark code as used (prevents race condition)
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
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    // 4. Get user details
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
      return res.status(404).json({ error: 'User not found' });
    }

    const cred = credentials[0];

    // 5. Save trusted device if requested
    if (trustDevice && deviceFingerprint) {
      const deviceHash = hashDeviceFingerprint(deviceFingerprint);
      const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_EXPIRY_MS);

      // Check if device already exists (update expiry) or insert new
      const existingDevice = await sql<DbRow<{ id: string }>[]>`
        SELECT id FROM trusted_devices
        WHERE user_id = ${cred.userId}
          AND device_hash = ${deviceHash}
        LIMIT 1
      `;

      if (existingDevice.length > 0) {
        // Update existing device expiry
        await sql`
          UPDATE trusted_devices
          SET expires_at = ${expiresAt}
          WHERE id = ${existingDevice[0].id}
        `;
      } else {
        // Insert new trusted device
        await sql`
          INSERT INTO trusted_devices (user_id, device_hash, device_name, expires_at)
          VALUES (${cred.userId}, ${deviceHash}, ${deviceName || 'Unknown Device'}, ${expiresAt})
        `;
      }
    }

    // 6. Update last_login timestamp
    await sql`
      UPDATE user_credentials 
      SET last_login = NOW() 
      WHERE user_id = ${cred.userId}
    `;

    // 7. Generate JTI for tokens
    const accessJTI = generateJTI();
    const refreshJTI = generateJTI();
    const tokenFamily = crypto.randomUUID();

    // 8. Generate Access Token with JTI
    const accessToken = jwt.sign(
      { userId: cred.userId, email: cred.email, permission: cred.permission, jti: accessJTI },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // 9. Generate Refresh Token with JTI
    const refreshToken = jwt.sign(
      { userId: cred.userId, email: cred.email, jti: refreshJTI },
      REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    // 10. Store refresh token in database
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    await sql`
      INSERT INTO refresh_tokens (
        user_id, jti, token_hash, token_family, expires_at
      ) VALUES (
        ${cred.userId},
        ${refreshJTI},
        ${crypto.createHash('sha256').update(refreshToken).digest('hex')},
        ${tokenFamily},
        ${refreshExpiresAt}
      )
    `;

    // 11. Set refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_EXPIRY_MS
    });

    // 12. Return success with tokens
    res.json({
      message: 'Login successful',
      token: accessToken,
      user: {
        id: cred.userId,
        firstName: cred.firstName,
        lastName: cred.lastName,
        email: cred.email,
      }
    });

  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('2FA verification error:', error);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resend2FA = async (req: Request, res: Response) => {
  const { userId } = req.body;

  try {
    // 1. Rate limiting - check how many codes sent in last 5 minutes
    const recentCodes = await sql<{ count: string }[]>`
      SELECT COUNT(*) as count
      FROM auth_codes
      WHERE user_id = ${userId}
        AND created_at > NOW() - INTERVAL '5 minutes'
    `;

    if (Number(recentCodes[0]?.count) >= 3) {
      return res.status(429).json({ error: 'Too many code requests. Please wait before requesting another code.' });
    }

    // 2. Get user details
    const credentials = await sql<(
      DbRow<Pick<UserCredentials, 'email'>> &
      DbRow<Pick<Users, 'first_name'>>
    )[]>`
      SELECT 
        uc.email,
        u.first_name
      FROM user_credentials uc
      JOIN users u ON u.id = uc.user_id
      WHERE uc.user_id = ${userId}
      LIMIT 1
    `;

    if (credentials.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const cred = credentials[0];

    // 3. Cleanup old/expired codes
    await sql`
      DELETE FROM auth_codes 
      WHERE user_id = ${userId}
        AND (expires_at < NOW() OR used_at IS NOT NULL)
    `;

    // 4. Generate new 6-digit 2FA code
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS);

    // 5. Store new 2FA code in database
    await sql`
      INSERT INTO auth_codes (user_id, code, expires_at)
      VALUES (${userId}, ${code}, ${expiresAt})
    `;

    // 6. Send 2FA code via email
    await send2FACode(cred.email, code, cred.firstName);

    res.json({
      message: 'New verification code sent to your email'
    });

  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Resend 2FA code error:', error);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    // 1. Check if user exists
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

    // Always return success (security: don't reveal if email exists)
    if (credentials.length === 0) {
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    const cred = credentials[0];

    // 2. Generate secure reset token (32 bytes = 64 hex chars)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

    // 3. Store hashed token in database
    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${cred.userId}, ${tokenHash}, ${expiresAt})
    `;

    // 4. Send email with reset link
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

    res.json({ message: 'If that email exists, a reset link has been sent' });

  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Forgot password error:', error);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  // Validate password
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // 1. Hash the incoming token and find it in database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const tokens = await sql<DbRow<PasswordResetTokens>[]>`
      SELECT * FROM password_reset_tokens
      WHERE token = ${tokenHash}
        AND expires_at > NOW()
        AND used_at IS NULL
      LIMIT 1
    `;

    if (tokens.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const resetToken = tokens[0];

    // 2. Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 3. Update user password
    await sql`
      UPDATE user_credentials
      SET password_hash = ${passwordHash}
      WHERE user_id = ${resetToken.userId}
    `;

    // 4. Revoke all existing refresh tokens for security
    await sql`
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = ${resetToken.userId}
        AND revoked_at IS NULL
    `;

    // 5. Mark reset token as used
    await sql`
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE id = ${resetToken.id}
    `;

    res.json({ message: 'Password reset successful - all sessions have been logged out' });

  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Reset password error:', error);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};
