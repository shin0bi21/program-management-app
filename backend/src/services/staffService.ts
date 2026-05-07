import bcrypt from 'bcryptjs';
import { sql } from '../db/client';
import type { Users, UserCredentials } from '../types/database';
import type { DbRow } from '../types/db';
import type { CreateStaffInput } from '../validation/staffSchemas';

type StaffRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'active' | 'created_at'>> & {
    email: string;
    role: string;
  };

export async function getStaff() {
  return sql<StaffRow[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.active,
      u.created_at,
      uc.email,
      ur.name AS role
    FROM users u
    INNER JOIN user_credentials uc ON uc.user_id = u.id
    INNER JOIN user_roles ur ON ur.id = u.role_id
    WHERE ur.name IN ('staff', 'admin')
    ORDER BY u.first_name ASC, u.last_name ASC
  `;
}

export async function createStaff(data: CreateStaffInput) {
  const { firstName, lastName, email, password, role = 'staff', active } = data;

  const passwordHash = await bcrypt.hash(password, 10);

  const roles = await sql<{ id: string }[]>`SELECT id FROM user_roles WHERE name = ${role}`;
  if (!roles.length) throw new Error(`Role '${role}' not found`);
  const roleId = roles[0].id;

  const newUsers = await sql<DbRow<Users>[]>`
    INSERT INTO users (first_name, last_name, role_id, active)
    VALUES (${firstName}, ${lastName}, ${roleId}, ${active})
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
      u.created_at,
      uc.email,
      ur.name AS role
    FROM users u
    INNER JOIN user_credentials uc ON uc.user_id = u.id
    INNER JOIN user_roles ur ON ur.id = u.role_id
    WHERE u.id = ${userId}
  `;

  return created[0];
}
