import crypto from 'crypto';
import { sql } from '../../db/client';
import { requireEnv } from '../../utils/env';

// HMAC key: reuse the app's JWT secret so no additional env var is needed.
// Deliberate tradeoff — if JWT_SECRET is ever compromised, an attacker can
// recompute hashes and de-anonymise historical log IPs.  Set LOG_HMAC_SECRET
// to a separate secret in production if you want independent key rotation.
const HMAC_SECRET = process.env.LOG_HMAC_SECRET ?? requireEnv('JWT_SECRET');

// Auth events mirror the security-relevant taxonomy in the
// OWASP Authentication Cheat Sheet — "Logging and Monitoring" section.
// token_reuse_detected: refresh-token rotation threat (see docs/backend/auth.md §5).
export type AuthEvent =
  | 'login_success'
  | 'login_failure'
  | 'account_locked'
  | '2fa_sent'
  | '2fa_resent'
  | '2fa_verified'
  | '2fa_failed'
  | 'trusted_device_added'
  | 'logout'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'token_reuse_detected';

interface AuthLogParams {
  event: AuthEvent;
  userId?: string;
  email?: string;
  ipAddress?: string;
  deviceFingerprintHash?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write an auth security event to auth_log.
 *
 * Fire-and-forget — failures are isolated so they never degrade the primary
 * auth flow (OWASP Logging Cheat Sheet — "Availability"). Errors are emitted
 * as structured logs so an aggregator can alert on sustained write failures.
 */
export async function authLog(params: AuthLogParams): Promise<void> {
  try {
    await sql`
      INSERT INTO auth_log (event, user_id, email, ip_hash, device_fingerprint_hash, metadata)
      VALUES (
        ${params.event},
        ${params.userId ?? null},
        ${params.email ?? null},
        ${params.ipAddress ? hashIpSubnet(params.ipAddress) : null},
        ${params.deviceFingerprintHash ?? null},
        ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb
      )
    `;
  } catch (err) {
    console.error('[auth_log] write failed', { event: params.event, userId: params.userId, err });
  }
}

/**
 * Expand a compressed IPv6 address to its full 8-group form so that
 * prefix extraction is reliable regardless of how the client supplied it.
 * Spec: RFC 4291 §2.2 — IPv6 text representation and '::' compression rules.
 */
function expandIPv6(ip: string): string {
  const halves = ip.split('::');
  if (halves.length !== 2) return ip;
  const left  = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const fill  = Array(8 - left.length - right.length).fill('0');
  return [...left, ...fill, ...right].join(':');
}

/**
 * HMAC-SHA256 of the IP's network prefix — individual host identity is
 * irrecoverable even with the HMAC key, but the same attacker subnet still
 * correlates across events and geographic signal is preserved.
 *
 * IPv4 — first 3 octets (/24):  "203.0.113.45"    → hash("203.0.113")
 * IPv6 — first 4 groups  (/64):  "2001:db8:1:2::1" → hash("2001:db8:1:2")
 *
 * Prefix-length rationale:
 *   IPv4 /24 — standard residential/business allocation unit.
 *   IPv6 /64 — RFC 4291 §2.5.4 defines /64 as the interface identifier
 *              boundary; hashing the prefix avoids exposing the Interface ID,
 *              which can encode a MAC address via EUI-64 (RFC 4291 §2.5.1).
 *
 * Privacy tradeoff: email is stored in plaintext alongside the hashed IP —
 * needed for support and incident investigation. The hash prevents bulk IP
 * enumeration but does not prevent identity linkage for a named user.
 * If your threat model requires stronger anonymisation, consider hashing or
 * omitting email at log time (OWASP Logging Cheat Sheet — "Data to exclude").
 */
function hashIpSubnet(ip: string): string {
  let prefix: string;

  const ipv4 = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (ipv4) {
    prefix = ipv4[1];
  } else {
    prefix = expandIPv6(ip).split(':').slice(0, 4).join(':');
  }

  return crypto.createHmac('sha256', HMAC_SECRET).update(prefix).digest('hex');
}
