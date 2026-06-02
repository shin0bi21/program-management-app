import { Request, Response } from 'express';
import {
  loginUser,
  verify2FACode,
  resend2FACode,
  rotateRefreshToken,
  logoutUser,
  requestPasswordReset,
  resetUserPassword,
} from '../services/authService';
import { UnauthorizedError } from '../errors';
import { REFRESH_TOKEN_EXPIRY_MS } from '../services/authService';

const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_EXPIRY_MS,
});

export const handleLogin = async (req: Request, res: Response) => {
  const { email, password, deviceFingerprint } = req.body;
  const result = await loginUser(email, password, deviceFingerprint, req.ip);
  if (result.type === 'success') {
    res.cookie('refreshToken', result.tokens.refreshToken, getRefreshTokenCookieOptions());
    return res.json({ message: 'Login successful (trusted device)', token: result.tokens.accessToken, user: result.user });
  }
  res.json({ message: '2FA code sent to your email', requires2FA: true, userId: result.userId });
};

export const handleRefreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token not found');
  }
  const { newAccessToken, newRefreshToken } = await rotateRefreshToken(refreshToken, req.ip);
  res.cookie('refreshToken', newRefreshToken, getRefreshTokenCookieOptions());
  res.json({ token: newAccessToken });
};

export const handleLogout = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  const authHeader = req.headers['authorization'];
  const accessToken = authHeader?.split(' ')[1];
  try {
    await logoutUser(refreshToken, accessToken, req.ip);
  } catch {
    // Swallow — clear cookie regardless
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};

export const handleVerify2FA = async (req: Request, res: Response) => {
  const { userId, code, trustDevice, deviceFingerprint, deviceName } = req.body;
  const result = await verify2FACode(userId, code, trustDevice, deviceFingerprint, deviceName, req.ip);
  res.cookie('refreshToken', result.tokens.refreshToken, getRefreshTokenCookieOptions());
  res.json({ message: 'Login successful', token: result.tokens.accessToken, user: result.user });
};

export const handleResend2FA = async (req: Request, res: Response) => {
  const { userId } = req.body;
  await resend2FACode(userId, req.ip);
  res.json({ message: 'New verification code sent to your email' });
};

export const handleForgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  await requestPasswordReset(email, req.ip);
  res.json({ message: 'If that email exists, a reset link has been sent' });
};

export const handleResetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  await resetUserPassword(token, newPassword, req.ip);
  res.json({ message: 'Password reset successful - all sessions have been logged out' });
};
