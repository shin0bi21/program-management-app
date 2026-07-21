import { apiClient } from './http/client';
import type { AuthUser } from '../utils/storage';

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

interface LoginApiVerificationResponse {
  message: string;
  requires2FA: true;
  userId: string;
}

type LoginResponse = LoginSuccessResponse | LoginVerificationResponse;

export async function login(
  email: string,
  password: string,
  deviceFingerprint?: string,
) : Promise<LoginResponse> {
  const data = await apiClient.post<LoginSuccessResponse | LoginApiVerificationResponse>(
    '/auth/login',
    { email, password, deviceFingerprint },
    NO_AUTH,
  );
  if ('requires2FA' in data) {
    return { message: data.message, requiresVerification: true, userId: data.userId };
  }
  return data;
}

interface AuthVerifyResponse {
  token: string;
  user: AuthUser;
}

export function verify2FA(
  userId: string,
  code: string,
  trustDevice: boolean,
  deviceFingerprint?: string,
  deviceName?: string,
) {
  return apiClient.post<AuthVerifyResponse>('/auth/verify', { userId, code, trustDevice, deviceFingerprint, deviceName }, NO_AUTH);
}

export function resend2FA(userId: string) {
  return apiClient.post('/auth/resend', { userId }, NO_AUTH);
}

export function forgotPassword(email: string) {
  return apiClient.post('/auth/forgot-password', { email }, NO_AUTH);
}

export function resetPassword(token: string, newPassword: string) {
  return apiClient.post('/auth/reset-password', { token, newPassword }, NO_AUTH);
}

export function logout() {
  return apiClient.post('/auth/logout', undefined, NO_AUTH);
}
