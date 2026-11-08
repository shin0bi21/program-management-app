import { Request, Response } from 'express';
import {
  loginUser,
  verify2FACode,
  resend2FACode,
  rotateRefreshToken,
  logoutUser,
  requestPasswordReset,
  resetUserPassword,
  REFRESH_TOKEN_EXPIRY_MS,
} from '../services/auth/authService';
import { UnauthorizedError } from '../errors';

/**
 * Starts email verification or sets the refresh cookie for an accepted device.
 * @example POST /api/auth/login returns requiresVerification and userId when a code is needed.
 */
export const handleLogin = async (req: Request, res: Response) => {
  const { email, password, deviceFingerprint } = req.body;
  const result = await loginUser(email, password, deviceFingerprint, req.ip);

  if (result.type === 'success') {
    res.cookie('refreshToken', result.tokens.refreshToken, getRefreshTokenCookieOptions());
    return res.json({ message: 'Login successful (trusted device)', token: result.tokens.accessToken, user: result.user });
  }
  res.json({ message: '2FA code sent to your email', requiresVerification: true, userId: result.userId });
};

/**
 * Rotates the refresh cookie and returns the replacement access token.
 * @example POST /api/auth/refresh rejects a missing refresh cookie with 401.
 */
export const handleRefreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token not found');
  }

  const { newAccessToken, newRefreshToken } = await rotateRefreshToken(refreshToken, req.ip);
  res.cookie('refreshToken', newRefreshToken, getRefreshTokenCookieOptions());
  res.json({ token: newAccessToken });
};

/**
 * Revokes the supplied session tokens and clears the refresh cookie even if revocation fails.
 * @example POST /api/auth/logout clears the cookie when no tokens are supplied.
 */
export const handleLogout = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  const authHeader = req.headers['authorization'];
  const accessToken = authHeader?.split(' ')[1];

  try {
    await logoutUser(refreshToken, accessToken, req.ip);
  } finally {
    res.clearCookie('refreshToken');
  }
  res.json({ message: 'Logged out successfully' });
};

/**
 * Consumes the submitted verification code, sets the refresh cookie, and returns the session.
 * @example POST /api/auth/verify returns the signed-in user and access token.
 */
export const handleVerify2FA = async (req: Request, res: Response) => {
  const { userId, code, trustDevice, deviceFingerprint, deviceName } = req.body;
  const result = await verify2FACode(userId, code, trustDevice, deviceFingerprint, deviceName, req.ip);
  res.cookie('refreshToken', result.tokens.refreshToken, getRefreshTokenCookieOptions());
  res.json({ message: 'Login successful', token: result.tokens.accessToken, user: result.user });
};

/**
 * Sends a replacement verification code using the service rate limits.
 * @example POST /api/auth/resend returns confirmation after sending the code.
 */
export const handleResend2FA = async (req: Request, res: Response) => {
  const { userId } = req.body;
  await resend2FACode(userId, req.ip);
  res.json({ message: 'New verification code sent to your email' });
};

/**
 * Requests a reset email without revealing whether the address belongs to an account.
 * @example POST /api/auth/forgot-password returns the same message for an unknown address.
 */
export const handleForgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  await requestPasswordReset(email, req.ip);
  res.json({ message: 'If that email exists, a reset link has been sent' });
};

/**
 * Consumes the emailed reset token and sets the replacement password.
 * @example POST /api/auth/reset-password confirms the change after refresh sessions are revoked.
 */
export const handleResetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  await resetUserPassword(token, newPassword, req.ip);
  res.json({ message: 'Password reset successful - all sessions have been logged out' });
};

/**
 * Supplies the shared eight-hour refresh-cookie policy for issued session tokens.
 * @example getRefreshTokenCookieOptions() // httpOnly cookie, secure in production
 */
const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_EXPIRY_MS,
});
