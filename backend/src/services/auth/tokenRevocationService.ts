import { sql } from '../../db/client';

// ============================================================================
// IN-MEMORY BLACKLIST CACHE
//
// Single source of truth for revoked access token JTIs. Both authMiddleware
// (reads) and authService (writes on logout) import from here — no more
// circular dependency.
//
// Future: swap the Set + DB polling for a Redis client. Only this file changes.
// ============================================================================

const blacklistCache = new Set<string>();
let lastCacheUpdate = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Check whether an access token JTI has been revoked.
 * Refreshes the in-memory cache from DB if it is stale (> 60s).
 * Called by authenticateToken on every protected request.
 */
export async function isBlacklisted(jti: string): Promise<boolean> {
  if (Date.now() - lastCacheUpdate > CACHE_TTL) {
    await refreshBlacklistCache();
  }
  return blacklistCache.has(jti);
}

/**
 * Persist a revoked access token to the DB blacklist and update the local
 * cache immediately. Called by logoutUser in authService.
 */
export async function revokeAccessToken(
  jti: string,
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await sql`
    INSERT INTO system_revoked_tokens (jti, user_id, token_hash, expires_at, reason)
    VALUES (${jti}, ${userId}, ${tokenHash}, ${expiresAt}, 'logout')
    ON CONFLICT (jti) DO NOTHING
  `;
  blacklistCache.add(jti);
}

async function refreshBlacklistCache(): Promise<void> {
  try {
    const blacklisted = await sql<{ jti: string }[]>`
      SELECT jti FROM system_revoked_tokens
      WHERE expires_at > NOW()
    `;

    blacklistCache.clear();
    blacklisted.forEach(row => blacklistCache.add(row.jti));
    lastCacheUpdate = Date.now();
  } catch (error) {
    console.error('Failed to refresh blacklist cache:', error);
  }
}

// Warm the cache on module load
refreshBlacklistCache();
