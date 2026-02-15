import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { sql } from '../db/client';
import type { Contacts, Schools, UserCredentials, UserGroups, Users, YouthProfiles } from '../types/database';
import type { DbRow } from '../types/db';

type StaffRow =
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

type YouthRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'created_at'>> &
  DbRow<Pick<YouthProfiles, 'date_of_birth' | 'school_id' | 'grade_level'>> &
  DbRow<Pick<Schools, 'name'>>;

export const getStaff = async (req: Request, res: Response) => {
  try {
    // Select users with their groups and contacts
    const users = await sql<StaffRow[]>`
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
      WHERE u.permission IN ('staff', 'admin')
      ORDER BY u.first_name ASC, u.last_name ASC
    `;

    res.json(users);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const createStaff = async (req: Request, res: Response) => {
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
        ${permission}::permission_level,
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
    res.status(500).json({ error: 'Failed to create staff user' });
  }
};

export const createYouth = async (req: Request, res: Response) => {
  const { firstName, lastName, groupId, dateOfBirth, schoolId, gradeLevel } = req.body;

  try {
    // 1. Insert user with permission = 'youth'
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
        'youth'::permission_level,
        ${groupId || null}
      )
      RETURNING *; 
    `;

    const newUser = newUsers[0];

    // 2. Insert youth profile
    await sql`
      INSERT INTO youth_profiles (
        user_id,
        date_of_birth,
        school_id,
        grade_level
      )
      VALUES (
        ${newUser.id},
        ${dateOfBirth || null},
        ${schoolId || null},
        ${gradeLevel || null}
      )
    `;

    res.status(201).json({
      id: newUser.id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      permission: newUser.permission,
      dateOfBirth: dateOfBirth || null,
      schoolId: schoolId || null,
      gradeLevel: gradeLevel || null,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to create youth profile' });
  }
};

export const getYouth = async (req: Request, res: Response) => {
  try {
    const youth = await sql<YouthRow[]>`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        yp.date_of_birth,
        yp.school_id,
        s.name as school_name,
        yp.grade_level,
        u.created_at
      FROM youth_profiles yp
      INNER JOIN users u ON u.id = yp.user_id
      LEFT JOIN schools s ON s.id = yp.school_id
      WHERE u.permission = 'youth'
      ORDER BY u.first_name ASC, u.last_name ASC
    `;

    res.json(youth);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to fetch youth profiles' });
  }
};
