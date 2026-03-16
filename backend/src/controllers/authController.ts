import { Request, Response } from 'express';
import {
  loginUser,
  verify2FACode,
  resend2FACode,
  rotateRefreshToken,
  logoutUser,
  requestPasswordReset,
  resetUserPassword,
  AuthError,
} from '../services/authService';

const REFRESH_TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_EXPIRY_MS,
});

function handleError(res: Response, err: unknown, context: string) {
  if (err instanceof AuthError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (process.env.NODE_ENV !== 'test') {
    console.error(`${context}:`, err);
  }
  return res.status(500).json({ error: 'Internal server error' });
}

export const handleLogin = async (req: Request, res: Response) => {
  const { email, password, deviceFingerprint } = req.body;
  try {
    const result = await loginUser(email, password, deviceFingerprint);
    if (result.type === 'success') {
      res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
      return res.json({ message: 'Login successful (trusted device)', token: result.tokens.accessToken, user: result.user });
    }
    res.json({ message: '2FA code sent to your email', requires2FA: true, userId: result.userId });
  } catch (err) {
    handleError(res, err, 'Login error');
  }
};

export const handleRefreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token not found' });
  }
  try {
    const { newAccessToken, newRefreshToken } = await rotateRefreshToken(refreshToken);
    res.cookie('refreshToken', newRefreshToken, cookieOptions());
    res.json({ token: newAccessToken });
  } catch (err) {
    handleError(res, err, 'Refresh token error');
  }
};

export const handleLogout = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  const authHeader = req.headers['authorization'];
  const accessToken = authHeader?.split(' ')[1];
  try {
    await logoutUser(refreshToken, accessToken);
  } catch {
    // Swallow — clear cookie regardless
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};

export const handleVerify2FA = async (req: Request, res: Response) => {
  const { userId, code, trustDevice, deviceFingerprint, deviceName } = req.body;
  try {
    const result = await verify2FACode(userId, code, trustDevice, deviceFingerprint, deviceName);
    res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
    res.json({ message: 'Login successful', token: result.tokens.accessToken, user: result.user });
  } catch (err) {
    handleError(res, err, '2FA verification error');
  }
};

export const handleResend2FA = async (req: Request, res: Response) => {
  const { userId } = req.body;
  try {
    await resend2FACode(userId);
    res.json({ message: 'New verification code sent to your email' });
  } catch (err) {
    handleError(res, err, 'Resend 2FA code error');
  }
};

export const handleForgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    await requestPasswordReset(email);
    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    handleError(res, err, 'Forgot password error');
  }
};

export const handleResetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  try {
    await resetUserPassword(token, newPassword);
    res.json({ message: 'Password reset successful - all sessions have been logged out' });
  } catch (err) {
    handleError(res, err, 'Reset password error');
  }
};
