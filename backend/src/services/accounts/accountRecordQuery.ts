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

export const accountRecordColumns = sql`
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

export const accountRecordFrom = sql`
  FROM users u
  INNER JOIN user_credentials uc ON uc.user_id = u.id
  INNER JOIN user_roles ur ON ur.id = u.role_id
`;
