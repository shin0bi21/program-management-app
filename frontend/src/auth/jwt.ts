export interface JwtPayload {
  exp?: number;
  role?: string;
  permissions?: string[];
  [claim: string]: unknown;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Decodes a JWT payload without verifying its signature.
 * Only the backend may treat token claims as trusted authorization data.
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const [, encodedPayload] = token.split('.');
    if (!encodedPayload) return null;
    return JSON.parse(decodeBase64Url(encodedPayload)) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenExpiry(token: string): number | null {
  const payload = decodeToken(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp * 1000;
}

export function isTokenExpired(token: string, now = Date.now()): boolean {
  const expiry = getTokenExpiry(token);
  return expiry === null || expiry <= now;
}

export function getTimeUntilExpiry(token: string, now = Date.now()): number | null {
  const expiry = getTokenExpiry(token);
  if (expiry === null) return null;
  return Math.max(0, expiry - now);
}
