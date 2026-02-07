const API_BASE = 'http://localhost:5001/api';

const parseErrorMessage = async (res: Response) => {
  try {
    const data = await res.json();
    return data?.error || data?.message;
  } catch {
    return null;
  }
};

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new Error(message || 'Request failed');
  }
  return res.json();
};

export async function login(
  email: string,
  password: string,
  deviceFingerprint?: string
) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, deviceFingerprint }),
  });

  const data = await handleResponse(res);
  if (data && typeof data === 'object' && 'requires2FA' in data) {
    return { ...data, requiresVerification: (data as any).requires2FA };
  }
  return data;
}

export async function verifyPassword(
  userId: string,
  code: string,
  trustDevice: boolean,
  deviceFingerprint?: string,
  deviceName?: string
) {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      userId,
      code,
      trustDevice,
      deviceFingerprint,
      deviceName,
    }),
  });

  return handleResponse(res);
}

export async function resendVerificationCode(userId: string) {
  const res = await fetch(`${API_BASE}/auth/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId }),
  });

  return handleResponse(res);
}

export async function forgotPassword(email: string) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });

  return handleResponse(res);
}

export async function resetPassword(token: string, newPassword: string) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, newPassword }),
  });

  return handleResponse(res);
}

export async function logout() {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new Error(message || 'Logout failed');
  }
}
