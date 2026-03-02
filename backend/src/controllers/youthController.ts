import { Request, Response } from 'express';
import { sql } from '../db/client';
import type { Addresses, Contacts, Schools, Users, YouthProfiles } from '../types/database';
import type { DbRow } from '../types/db';

type YouthRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'active' | 'created_at'>> &
  DbRow<Pick<YouthProfiles, 'date_of_birth' | 'school_id' | 'grade_level'>> &
  DbRow<Pick<Schools, 'name'>>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function setAddresses(
  userId: string,
  addressesData: Array<{ id?: string; address: string; city: string; province: string; postalCode: string }>,
) {
  const existingLinks = await sql<{ addressId: string; address: string; city: string; province: string; postalCode: string }[]>`
    SELECT uha.address_id as "addressId", a.address, a.city, a.province, a.postal_code as "postalCode"
    FROM user_has_addresses uha
    JOIN addresses a ON uha.address_id = a.id
    WHERE uha.user_id = ${userId}
  `;

  const existingAddressMap = new Map(
    existingLinks
      .filter(link => link.addressId)
      .map(link => [link.addressId, {
        address: link.address,
        city: link.city,
        province: link.province,
        postalCode: link.postalCode,
      }]),
  );

  const toInsert: typeof addressesData = [];
  const toUpdate: typeof addressesData = [];
  const requestedIds = new Set<string>();

  for (const addressData of addressesData) {
    if (addressData.id) {
      requestedIds.add(addressData.id);
      const existing = existingAddressMap.get(addressData.id);
      if (existing) {
        const hasChanged =
          existing.address !== addressData.address ||
          existing.city !== addressData.city ||
          existing.province !== addressData.province ||
          existing.postalCode !== addressData.postalCode;
        if (hasChanged) toUpdate.push(addressData);
      }
    } else {
      toInsert.push(addressData);
    }
  }

  const toDelete = [...existingAddressMap.keys()].filter(id => !requestedIds.has(id));

  if (toDelete.length > 0) {
    await sql`
      DELETE FROM user_has_addresses 
      WHERE user_id = ${userId} AND address_id IN ${sql(toDelete)}
    `;
  }

  if (toUpdate.length > 0) {
    const ids = toUpdate.map(item => item.id!);
    const addresses = toUpdate.map(item => item.address);
    const cities = toUpdate.map(item => item.city);
    const provinces = toUpdate.map(item => item.province);
    const postalCodes = toUpdate.map(item => item.postalCode);

    await sql`
      UPDATE addresses AS a
      SET 
        address = updates.address,
        city = updates.city,
        province = updates.province,
        postal_code = updates.postal_code,
        updated_at = NOW()
      FROM (
        SELECT * FROM UNNEST(
          ${sql.array(ids)}::uuid[],
          ${sql.array(addresses)}::text[],
          ${sql.array(cities)}::text[],
          ${sql.array(provinces)}::text[],
          ${sql.array(postalCodes)}::text[]
        ) AS t(id, address, city, province, postal_code)
      ) AS updates
      WHERE a.id = updates.id
    `;
  }

  for (const addressData of toInsert) {
    const newAddresses = await sql<DbRow<Addresses>[]>`
      INSERT INTO addresses (address, city, province, postal_code, country)
      VALUES (${addressData.address}, ${addressData.city}, ${addressData.province}, ${addressData.postalCode}, 'Canada')
      RETURNING *
    `;

    await sql`
      INSERT INTO user_has_addresses (user_id, address_id)
      VALUES (${userId}, ${newAddresses[0].id})
    `;
  }
}

async function setContacts(
  userId: string,
  contactsData: Array<{ id?: string; firstName: string; lastName: string; phoneNumber?: string; type: string }>,
) {
  const existingLinks = await sql<{ contactId: string; firstName: string; lastName: string; phoneNumber: string | null; type: string }[]>`
    SELECT uhc.contact_id as "contactId", c.first_name as "firstName", c.last_name as "lastName", c.phone_number as "phoneNumber", c.type
    FROM user_has_contacts uhc
    JOIN contacts c ON uhc.contact_id = c.id
    WHERE uhc.user_id = ${userId}
  `;

  const existingContactMap = new Map(
    existingLinks
      .filter(link => link.contactId)
      .map(link => [link.contactId, {
        firstName: link.firstName,
        lastName: link.lastName,
        phoneNumber: link.phoneNumber || '',
        type: link.type,
      }]),
  );

  const toInsert: typeof contactsData = [];
  const toUpdate: typeof contactsData = [];
  const requestedIds = new Set<string>();

  for (const contactData of contactsData) {
    if (contactData.id) {
      requestedIds.add(contactData.id);
      const existing = existingContactMap.get(contactData.id);
      if (existing) {
        const hasChanged =
          existing.firstName !== contactData.firstName ||
          existing.lastName !== contactData.lastName ||
          existing.phoneNumber !== (contactData.phoneNumber || '') ||
          existing.type !== contactData.type;
        if (hasChanged) toUpdate.push(contactData);
      }
    } else {
      toInsert.push(contactData);
    }
  }

  const toDelete = [...existingContactMap.keys()].filter(id => !requestedIds.has(id));

  if (toDelete.length > 0) {
    await sql`
      DELETE FROM user_has_contacts 
      WHERE user_id = ${userId} AND contact_id IN ${sql(toDelete)}
    `;
  }

  if (toUpdate.length > 0) {
    const ids = toUpdate.map(item => item.id!);
    const firstNames = toUpdate.map(item => item.firstName);
    const lastNames = toUpdate.map(item => item.lastName);
    const phoneNumbers = toUpdate.map(item => item.phoneNumber || null);
    const types = toUpdate.map(item => item.type);

    await sql`
      UPDATE contacts AS c
      SET 
        first_name = updates.first_name,
        last_name = updates.last_name,
        phone_number = updates.phone_number,
        type = updates.type::contact_type,
        updated_at = NOW()
      FROM (
        SELECT * FROM UNNEST(
          ${sql.array(ids)}::uuid[],
          ${sql.array(firstNames)}::text[],
          ${sql.array(lastNames)}::text[],
          ${sql.array(phoneNumbers)}::text[],
          ${sql.array(types)}::text[]
        ) AS t(id, first_name, last_name, phone_number, type)
      ) AS updates
      WHERE c.id = updates.id
    `;
  }

  for (const contactData of toInsert) {
    const newContacts = await sql<DbRow<Contacts>[]>`
      INSERT INTO contacts (first_name, last_name, phone_number, type)
      VALUES (${contactData.firstName}, ${contactData.lastName}, ${contactData.phoneNumber || null}, ${contactData.type}::contact_type)
      RETURNING *
    `;

    await sql`
      INSERT INTO user_has_contacts (user_id, contact_id)
      VALUES (${userId}, ${newContacts[0].id})
    `;
  }
}

// ============================================================================
// YOUTH MANAGEMENT
// ============================================================================

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

    res.json(id ? youth[0] || null : youth);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to fetch youth profiles' });
  }
};

export const setYouth = async (req: Request, res: Response) => {
  const { id, firstName, lastName, groupId, dateOfBirth, schoolId, gradeLevel, active, addresses, contacts } = req.body;

  try {
    let userId: string;

    if (id) {
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

      await sql`
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id, grade_level, created_at, updated_at)
        VALUES (
          ${userId},
          ${dateOfBirth || null},
          ${schoolId || null},
          ${gradeLevel ?? null},
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
      const newUsers = await sql<DbRow<Users>[]>`
        INSERT INTO users (first_name, last_name, permission, group_id, active)
        VALUES (${firstName}, ${lastName}, 'youth'::permission_level, ${groupId || null}, ${active})
        RETURNING *
      `;

      userId = newUsers[0].id;

      await sql`
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id, grade_level)
        VALUES (${userId}, ${dateOfBirth || null}, ${schoolId || null}, ${gradeLevel ?? null})
      `;
    }

    if (id) {
      await setAddresses(userId, addresses || []);
      await setContacts(userId, contacts || []);
    } else {
      if (addresses && addresses.length > 0) await setAddresses(userId, addresses);
      if (contacts && contacts.length > 0) await setContacts(userId, contacts);
    }

    res.status(id ? 200 : 201).json({ id: userId });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: id ? 'Failed to update youth profile' : 'Failed to create youth profile' });
  }
};
