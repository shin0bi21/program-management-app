import { api } from '../../../../common/api/config';
import { handleApiError } from '../../../../common/utils/errors';

export async function login(
  email: string,
  password: string,
  deviceFingerprint?: string
) {
  const res = await fetch(api('/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, deviceFingerprint }),
  });

  await handleApiError(res);
  const data = await res.json();

  if (data && typeof data === 'object' && 'requires2FA' in data) {
    return { ...data, requiresVerification: (data as any).requires2FA };
  }
  return data;
}

export async function verify2FA(
  userId: string,
  code: string,
  trustDevice: boolean,
  deviceFingerprint?: string,
  deviceName?: string
) {
  const res = await fetch(api('/auth/verify'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, code, trustDevice, deviceFingerprint, deviceName }),
  });

  await handleApiError(res);
  return res.json();
}

export async function resend2FA(userId: string) {
  const res = await fetch(api('/auth/resend'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  await handleApiError(res);
  return res.json();
}

export async function forgotPassword(email: string) {
  const res = await fetch(api('/auth/forgot-password'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  await handleApiError(res);
  return res.json();
}

export async function resetPassword(token: string, newPassword: string) {
  const res = await fetch(api('/auth/reset-password'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });

  await handleApiError(res);
  return res.json();
}

export async function logout() {
  const res = await fetch(api('/auth/logout'), {
    method: 'POST',
    credentials: 'include',
  });

  await handleApiError(res);
  return res.json();
}
