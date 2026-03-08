import bcrypt from 'bcryptjs';
import { sql } from '../db/client';
import type { Users, UserCredentials } from '../types/database';
import type { DbRow } from '../types/db';

type StaffRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'active' | 'permission' | 'created_at'>> & {
    email: string;
  };

export interface CreateStaffInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  permission?: 'staff' | 'admin';
  active: boolean;
}

export async function getStaff() {
  return sql<StaffRow[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.active,
      u.permission,
      u.created_at,
      uc.email
    FROM users u
    INNER JOIN user_credentials uc ON uc.user_id = u.id
    WHERE u.permission IN ('staff', 'admin')
    ORDER BY u.first_name ASC, u.last_name ASC
  `;
}

export async function createStaff(data: CreateStaffInput) {
  const { firstName, lastName, email, password, permission = 'staff', active } = data;

  const passwordHash = await bcrypt.hash(password, 10);

  const newUsers = await sql<DbRow<Users>[]>`
    INSERT INTO users (first_name, last_name, permission, active)
    VALUES (${firstName}, ${lastName}, ${permission}::permission_level, ${active})
    RETURNING *
  `;

  const userId = newUsers[0].id;

  await sql<DbRow<UserCredentials>[]>`
    INSERT INTO user_credentials (user_id, email, password_hash)
    VALUES (${userId}, ${email}, ${passwordHash})
  `;

  const created = await sql<StaffRow[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.active,
      u.permission,
      u.created_at,
      uc.email
    FROM users u
    INNER JOIN user_credentials uc ON uc.user_id = u.id
    WHERE u.id = ${userId}
  `;

  return created[0];
}
