import { describe, expect, it } from 'vitest';
import { decodeToken, getTimeUntilExpiry, getTokenExpiry, isTokenExpired } from './jwt';

function encodePayload(payload: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function token(payload: object): string {
  return `header.${encodePayload(payload)}.signature`;
}

describe('JWT helpers', () => {
  it('decodes base64url and UTF-8 payloads without trusting the signature', () => {
    expect(decodeToken(token({ role: 'admin', label: 'Montréal' }))).toEqual({
      role: 'admin',
      label: 'Montréal',
    });
  });

  it('returns null for malformed tokens and payloads', () => {
    expect(decodeToken('not-a-jwt')).toBeNull();
    expect(decodeToken('header.%%%25.signature')).toBeNull();
  });

  it('reports missing, current, and past expirations as expired', () => {
    const now = 1_800_000_000_000;

    expect(isTokenExpired(token({}), now)).toBe(true);
    expect(isTokenExpired(token({ exp: now / 1000 }), now)).toBe(true);
    expect(isTokenExpired(token({ exp: now / 1000 - 1 }), now)).toBe(true);
    expect(isTokenExpired(token({ exp: now / 1000 + 1 }), now)).toBe(false);
  });

  it('returns expiration timestamps and clamps remaining time to zero', () => {
    const exp = 1_800_000_001;
    const encodedToken = token({ exp });

    expect(getTokenExpiry(encodedToken)).toBe(exp * 1000);
    expect(getTimeUntilExpiry(encodedToken, exp * 1000 - 250)).toBe(250);
    expect(getTimeUntilExpiry(encodedToken, exp * 1000 + 250)).toBe(0);
    expect(getTimeUntilExpiry(token({}))).toBeNull();
  });
});
