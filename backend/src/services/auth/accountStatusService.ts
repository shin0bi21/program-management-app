import { sql } from '../../db/client';

/**
 * Checks whether the user has active account credentials; missing credentials are inactive.
 * Database failures propagate to the caller rather than being treated as an inactive account.
 * @param userId - User whose current credential status must be read.
 * @returns Whether the stored account status is active.
 * @example await isAccountActive('00000000-0000-0000-0000-000000000001') // false if credentials are missing
 */
export async function isAccountActive(userId: string): Promise<boolean> {
  const [account] = await sql<{ status: string }[]>`
    SELECT status FROM user_credentials
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  return account?.status === 'active';
}
