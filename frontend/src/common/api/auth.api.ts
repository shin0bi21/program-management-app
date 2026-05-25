import { apiClient } from './client';

const NO_AUTH = { auth: false } as const;

export async function login(
  email: string,
  password: string,
  deviceFingerprint?: string,
) {
  const data = await apiClient.post<any>('/auth/login', { email, password, deviceFingerprint }, NO_AUTH);
  if (data && typeof data === 'object' && 'requires2FA' in data) {
    return { ...data, requiresVerification: (data as any).requires2FA };
  }
  return data;
}

interface AuthVerifyResponse {
  token: string;
  user: unknown;
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
