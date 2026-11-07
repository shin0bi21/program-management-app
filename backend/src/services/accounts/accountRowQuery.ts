import { sql } from '../../db/client';
import type { Users, UserCredentials } from '../../types/database';
import type { DbRow } from '../../types/db';

export type AccountRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'created_at'>> &
  DbRow<Pick<UserCredentials, 'status'>> & {
    email: string;
    role: string;
    programIds: string[];
  };

export const accountRowColumns = sql`
  u.id,
  u.first_name,
  u.last_name,
  uc.status,
  u.created_at,
  uc.email,
  ur.name AS role,
  ARRAY(
    SELECT assignment.program_id
    FROM user_program_assignments assignment
    WHERE assignment.user_id = u.id
    ORDER BY assignment.program_id
  ) AS program_ids
`;

export const accountRowFrom = sql`
  FROM users u
  INNER JOIN user_credentials uc ON uc.user_id = u.id
  INNER JOIN user_roles ur ON ur.id = u.role_id
`;

/**
 * Builds rows for table and calendar items.
 * @param appliedFilters - SQL filters supplied by the service.
 * @param query - Database client; pass trx inside a transaction.
 * @example getAccountRows(appliedFilters, trx)
 */
export function getAccountRows(appliedFilters = sql`TRUE`, query = sql) {
  return query<AccountRow[]>`
    SELECT ${accountRowColumns}
    ${accountRowFrom}
    WHERE ${appliedFilters}
  `;
}
