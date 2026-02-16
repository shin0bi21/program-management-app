import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { sql } from '../db/client';
import type { Addresses, Contacts, Schools, UserCredentials, UserGroups, Users, YouthProfiles } from '../types/database';
import type { DbRow } from '../types/db';

type StaffRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'permission' | 'group_id' | 'active' | 'created_at' | 'updated_at'>> &
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
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'active' | 'created_at'>> &
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
        u.active,
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
  const { firstName, lastName, groupId, email, password, permission, active } = req.body;

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
        group_id,
        active
      )
      VALUES (
        ${firstName}, 
        ${lastName}, 
        ${permission}::permission_level,
        ${groupId || null},
        ${active}
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function setAddress(userId: string, addressData: { address: string; city: string; province: string; postalCode: string }) {
  // Delete existing address links for this user
  await sql`DELETE FROM user_has_addresses WHERE user_id = ${userId}`;
  
  // Insert new address
  const newAddresses = await sql<DbRow<Addresses>[]>`
    INSERT INTO addresses (
      address,
      city,
      province,
      postal_code,
      country
    )
    VALUES (
      ${addressData.address},
      ${addressData.city},
      ${addressData.province},
      ${addressData.postalCode},
      'Canada'
    )
    RETURNING *
  `;

  const newAddress = newAddresses[0];

  // Link user to address
  await sql`
    INSERT INTO user_has_addresses (
      user_id,
      address_id
    )
    VALUES (
      ${userId},
      ${newAddress.id}
    )
  `;
}

async function setContact(userId: string, contactData: { firstName: string; lastName: string; phoneNumber?: string; type: string }) {
  // Delete existing contact links for this user
  await sql`DELETE FROM user_has_contacts WHERE user_id = ${userId}`;
  
  // Insert new contact
  const newContacts = await sql<DbRow<Contacts>[]>`
    INSERT INTO contacts (
      first_name,
      last_name,
      phone_number,
      type
    )
    VALUES (
      ${contactData.firstName},
      ${contactData.lastName},
      ${contactData.phoneNumber || null},
      ${contactData.type}::contact_type
    )
    RETURNING *
  `;

  const newContact = newContacts[0];

  // Link user to contact
  await sql`
    INSERT INTO user_has_contacts (
      user_id,
      contact_id
    )
    VALUES (
      ${userId},
      ${newContact.id}
    )
  `;
}

// ============================================================================
// YOUTH MANAGEMENT
// ============================================================================

export const setYouth = async (req: Request, res: Response) => {
  const { id, firstName, lastName, groupId, dateOfBirth, schoolId, gradeLevel, active, address, contact } = req.body;

  try {
    let userId: string;

    if (id) {
      // UPSERT user (update if exists)
      const users = await sql<DbRow<Users>[]>`
        INSERT INTO users (id, first_name, last_name, permission, group_id, active, created_at, updated_at)
        VALUES (
          ${id},
          ${firstName},
          ${lastName},
          'youth'::permission_level,
          ${groupId || null},
          ${active},
          COALESCE((SELECT created_at FROM users WHERE id = ${id}), NOW()),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          group_id = EXCLUDED.group_id,
          active = EXCLUDED.active,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;

      userId = users[0].id;

      // UPSERT youth_profiles (update if exists)
      await sql`
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id, grade_level, created_at, updated_at)
        VALUES (
          ${userId},
          ${dateOfBirth || null},
          ${schoolId || null},
          ${gradeLevel || null},
          COALESCE((SELECT created_at FROM youth_profiles WHERE user_id = ${userId}), NOW()),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          date_of_birth = EXCLUDED.date_of_birth,
          school_id = EXCLUDED.school_id,
          grade_level = EXCLUDED.grade_level,
          updated_at = EXCLUDED.updated_at
      `;
    } else {
      // INSERT new youth
      const newUsers = await sql<DbRow<Users>[]>`
        INSERT INTO users (
          first_name, 
          last_name, 
          permission,
          group_id,
          active
        )
        VALUES (
          ${firstName}, 
          ${lastName}, 
          'youth'::permission_level,
          ${groupId || null},
          ${active}
        )
        RETURNING *
      `;

      const newUser = newUsers[0];
      userId = newUser.id;

      // Insert youth profile
      await sql`
        INSERT INTO youth_profiles (
          user_id,
          date_of_birth,
          school_id,
          grade_level
        )
        VALUES (
          ${userId},
          ${dateOfBirth || null},
          ${schoolId || null},
          ${gradeLevel || null}
        )
      `;
    }

    // Handle address using helper function
    if (address) {
      await setAddress(userId, address);
    }

    // Handle contact using helper function
    if (contact) {
      await setContact(userId, contact);
    }

    res.status(id ? 200 : 201).json({ id: userId });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: id ? 'Failed to update youth profile' : 'Failed to create youth profile' });
  }
};

export const getYouth = async (req: Request, res: Response) => {
  try {
    const id = req.query.id as string | undefined;

    const youth = await sql<YouthRow[]>`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.active,
        yp.date_of_birth,
        yp.school_id,
        s.name as school_name,
        yp.grade_level,
        u.created_at,
        (
          SELECT json_agg(
            json_build_object(
              'id', a.id,
              'address', a.address,
              'city', a.city,
              'province', a.province,
              'postalCode', a.postal_code,
              'country', a.country
            )
          )
          FROM addresses a
          INNER JOIN user_has_addresses uha ON uha.address_id = a.id
          WHERE uha.user_id = u.id
        ) as addresses,
        (
          SELECT json_agg(
            json_build_object(
              'id', c.id,
              'firstName', c.first_name,
              'lastName', c.last_name,
              'phoneNumber', c.phone_number,
              'type', c.type
            )
          )
          FROM contacts c
          INNER JOIN user_has_contacts uhc ON uhc.contact_id = c.id
          WHERE uhc.user_id = u.id
        ) as contacts
      FROM youth_profiles yp
      INNER JOIN users u ON u.id = yp.user_id
      LEFT JOIN schools s ON s.id = yp.school_id
      WHERE u.permission = 'youth'
        ${id ? sql`AND u.id = ${id}` : sql``}
      ORDER BY u.first_name ASC, u.last_name ASC
    `;

    // If id provided, return single object, otherwise array
    res.json(id ? youth[0] || null : youth);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to fetch youth profiles' });
  }
};



