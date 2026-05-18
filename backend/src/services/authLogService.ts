import crypto from 'crypto';
import { sql } from '../db/client';
import { requireEnv } from '../utils/env';

// HMAC key: reuse the app's JWT secret so no additional env var is needed.
// Deliberate tradeoff — if JWT_SECRET is ever compromised, an attacker can
// recompute hashes and de-anonymise historical log IPs.  Set LOG_HMAC_SECRET
// to a separate secret in production if you want independent key rotation
// (rotate the log key without invalidating refresh tokens, or vice versa).
//
// Pattern: keyed-hash pseudonymisation.
// Spec:     GDPR Art. 4(5) — definition of pseudonymisation.
//           EU WP29 Opinion 05/2014 on Anonymisation Techniques §3.3
//             ("keyed-hash" described as pseudonymous, not anonymous).
//           RFC 2104 — HMAC construction.
const HMAC_SECRET = process.env.LOG_HMAC_SECRET ?? requireEnv('JWT_SECRET');

/**
 * Expand a compressed IPv6 address to its full 8-group form so that
 * prefix extraction is reliable regardless of how the client supplied it.
 *
 * "2001:db8::1"      → "2001:db8:0:0:0:0:0:1"
 * "2001:db8:1:2::1"  → "2001:db8:1:2:0:0:0:1"
 * Already-full addresses pass through unchanged.
 *
 * Spec: RFC 4291 §2.2 — IPv6 text representation and '::' compression rules.
 *       The algorithm here is the inverse of §2.2 rule 2 (consecutive all-zero
 *       groups MAY be replaced by '::' once); we simply reverse that.
 */
function expandIPv6(ip: string): string {
  const halves = ip.split('::');
  if (halves.length !== 2) return ip; // no '::' — already fully expanded
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
 *   IPv4 /24  — standard residential/business allocation unit; balances
 *               correlation signal against over-identification of NAT ranges.
 *   IPv6 /64  — RFC 4291 §2.5.4 defines /64 as the standard interface
 *               identifier boundary; ISPs assign one /64 per subscriber.
 *               Hashing the /64 prefix preserves subnet correlation without
 *               exposing the 64-bit Interface ID (which can encode a MAC
 *               address via EUI-64 — RFC 4291 §2.5.1).
 *
 * The address is expanded before slicing so compressed forms like
 * "2001:db8::1" (which naively splits into too few groups) are handled
 * correctly.  Spec: RFC 4291 §2.2.
 *
 * Privacy tradeoff: email is stored in plaintext alongside the hashed IP.
 * This is intentional — email is needed for support and incident investigation.
 * The hash prevents bulk IP enumeration; it does not prevent identity linkage
 * for a named user whose email appears in the log.  If your threat model or
 * jurisdiction (e.g. GDPR Art. 5(1)(c) data minimisation) requires stronger
 * anonymisation, consider hashing or omitting email at log time.
 * Ref: OWASP Logging Cheat Sheet — "Data to exclude" section.
 */
function hashIpSubnet(ip: string): string {
  let prefix: string;

  const ipv4 = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (ipv4) {
    prefix = ipv4[1]; // e.g. "203.0.113"
  } else {
    prefix = expandIPv6(ip).split(':').slice(0, 4).join(':'); // e.g. "2001:db8:1:2"
  }

  return crypto.createHmac('sha256', HMAC_SECRET).update(prefix).digest('hex');
}

// Auth events to record.
// The set mirrors the security-relevant events enumerated in:
//   OWASP Authentication Cheat Sheet — "Logging and Monitoring" section.
//   OWASP Application Logging Vocabulary (draft) — authentication event taxonomy.
// token_reuse_detected is specific to refresh-token rotation (RFC 6749 §10.4
// threat model; described in our backend/docs/auth.md §5 Refresh Rotation).
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
 * Pattern: fire-and-forget logging — the log write is best-effort; failures
 * are isolated so they never degrade the primary auth flow.
 * Ref: OWASP Logging Cheat Sheet — "Availability" section: logging
 *      infrastructure failure must not impact application availability.
 *
 * Failures are emitted as structured error logs so an aggregator (e.g.
 * Datadog, CloudWatch, Loki) can alert on a sustained burst of write
 * failures without requiring code changes.
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
    // Structured so log aggregators can filter on the tag and event name.
    console.error('[auth_log] write failed', { event: params.event, userId: params.userId, err });
  }
}
