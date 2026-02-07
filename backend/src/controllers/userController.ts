import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { sql } from '../db/client';
import type { Contacts, UserCredentials, UserGroups, Users } from '../types/database';
import type { DbRow } from '../types/db';

type UserWithContactsRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'permission' | 'group_id' | 'created_at' | 'updated_at'>> &
  DbRow<Pick<UserGroups, 'name'>> &
  DbRow<Pick<UserCredentials, 'email' | 'last_login'>> & {
    contacts: Array<{
      id: DbRow<Pick<Contacts, 'id'>>['id'];
      firstName: DbRow<Pick<Contacts, 'first_name'>>['firstName'];
      lastName: DbRow<Pick<Contacts, 'last_name'>>['lastName'];
      phoneNumber: DbRow<Pick<Contacts, 'phone_number'>>['phoneNumber'];
      type: DbRow<Pick<Contacts, 'type'>>['type'];
    }> | null;
  };

export const getUsers = async (req: Request, res: Response) => {
  try {
    // Select users with their groups and contacts
    const users = await sql<UserWithContactsRow[]>`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.permission,
        u.group_id,
        u.created_at,
        u.updated_at,
        ug.name as group_name,
        uc.email,
        uc.last_login,
        (
          SELECT json_agg(
            json_build_object(
              'id', c.id,
              'first_name', c.first_name,
              'last_name', c.last_name,
              'phone_number', c.phone_number,
              'type', c.type
            )
          )
          FROM user_has_contacts uhc
          JOIN contacts c ON uhc.contact_id = c.id
          WHERE uhc.user_id = u.id
        ) as contacts
      FROM users u
      LEFT JOIN user_groups ug ON u.group_id = ug.id
      LEFT JOIN user_credentials uc ON u.id = uc.user_id
    `;

    res.json(users);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  const { firstName, lastName, groupId, email, password, permission } = req.body;

  try {
    // 1. Hash Password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 2. Insert user (with permission enum, default to 'youth')
    const newUsers = await sql<DbRow<Users>[]>`
      INSERT INTO users (
        first_name, 
        last_name, 
        permission,
        group_id
      )
      VALUES (
        ${firstName}, 
        ${lastName}, 
        ${permission || 'youth'}::permission_level,
        ${groupId || null}
      )
      RETURNING *; 
    `;

    const newUser = newUsers[0];

    // 3. Insert credentials
    await sql`
      INSERT INTO user_credentials (
        user_id,
        email,
        password_hash,
        email_verified
      )
      VALUES (
        ${newUser.id},
        ${email},
        ${passwordHash},
        false
      )
    `;

    res.status(201).json({
      id: newUser.id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      permission: newUser.permission,
      email
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
};
