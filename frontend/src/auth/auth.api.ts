import { apiClient } from '../http/client';
import type { AuthUser } from './storage';

const NO_AUTH = { auth: false } as const;

interface LoginSuccessResponse {
  message: string;
  token: string;
  user: AuthUser;
  requiresVerification?: never;
  userId?: never;
}

interface LoginVerificationResponse {
  message: string;
  requiresVerification: true;
  userId: string;
  token?: never;
  user?: never;
}

type LoginResponse = LoginSuccessResponse | LoginVerificationResponse;

/**
 * Checks credentials and returns either an authenticated session or a verification challenge.
 * @param email - Account email supplied at sign-in.
 * @param password - Account password supplied at sign-in.
 * @param deviceFingerprint - Current browser identifier used to recognize a trusted device.
 * @example await login('member@example.com', 'secret') // session or requiresVerification challenge
 */
export function login(
  email: string,
  password: string,
  deviceFingerprint?: string,
) : Promise<LoginResponse> {
  return apiClient.post<LoginResponse>(
    '/auth/login',
    { email, password, deviceFingerprint },
    NO_AUTH,
  );
}

interface AuthVerifyResponse {
  token: string;
  user: AuthUser;
}

/**
 * Exchanges an emailed verification code for an authenticated session.
 * @param userId - Account awaiting verification after sign-in.
 * @param code - Verification code entered by the account owner.
 * @param trustDevice - Whether successful verification should trust this browser.
 * @param deviceFingerprint - Browser identifier to associate with that trust.
 * @param deviceName - Human-readable browser name for the trusted-device record.
 * @example await verify2FA('user-1', '123456', false) // authenticated token and user
 */
export function verify2FA(
  userId: string,
  code: string,
  trustDevice: boolean,
  deviceFingerprint?: string,
  deviceName?: string,
) {
  return apiClient.post<AuthVerifyResponse>('/auth/verify', { userId, code, trustDevice, deviceFingerprint, deviceName }, NO_AUTH);
}

/**
 * Requests another verification email for an account awaiting sign-in verification.
 * @param userId - Account identified by the login challenge.
 * @example await resend2FA('user-1') // sends another verification code
 */
export function resend2FA(userId: string) {
  return apiClient.post('/auth/resend', { userId }, NO_AUTH);
}

/**
 * Requests password-reset instructions without requiring an authenticated session.
 * @param email - Account email entered on the recovery form.
 * @example await forgotPassword('member@example.com') // requests reset instructions
 */
export function forgotPassword(email: string) {
  return apiClient.post('/auth/forgot-password', { email }, NO_AUTH);
}

/**
 * Replaces an account password using its emailed reset token.
 * @param token - Reset token supplied in the recovery link.
 * @param newPassword - Validated replacement password; confirmation stays in the form.
 * @example await resetPassword('reset-token', 'replacement-password') // saves the new password
 */
export function resetPassword(token: string, newPassword: string) {
  return apiClient.post('/auth/reset-password', { token, newPassword }, NO_AUTH);
}

/**
 * Requests server-side sign-out; the caller owns clearing local authentication state.
 * @example await logout() // completes the sign-out request
 */
export function logout() {
  return apiClient.post('/auth/logout', undefined, NO_AUTH);
}
