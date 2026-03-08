import { sql } from '../db/client';
import type { Schools, Users, YouthProfiles } from '../types/database';
import type { DbRow } from '../types/db';
import { setAddresses } from './addressService';
import { setContacts } from './contactService';

type YouthRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'active' | 'created_at'>> &
  DbRow<Pick<YouthProfiles, 'date_of_birth' | 'school_id' | 'grade_level' | 'age_group'>> &
  DbRow<Pick<Schools, 'name'>>;

// ============================================================================
// QUERIES
// ============================================================================

export async function getYouth(id?: string) {
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
      yp.age_group,
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
        WHERE uha.user_id = u.id AND uha.active = true
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
        WHERE uhc.user_id = u.id AND uhc.active = true
      ) as contacts
    FROM youth_profiles yp
    INNER JOIN users u ON u.id = yp.user_id
    LEFT JOIN schools s ON s.id = yp.school_id
    WHERE u.permission = 'youth'
      ${id ? sql`AND u.id = ${id}` : sql``}
    ORDER BY u.first_name ASC, u.last_name ASC
  `;
  return id ? youth[0] || null : youth;
}

export interface SetYouthInput {
  id?: string;
  firstName: string;
  lastName: string;
  active: boolean;
  dateOfBirth?: string;
  schoolId?: string;
  gradeLevel?: number;
  addresses?: Array<{ id?: string; address: string; city: string; province: string; postalCode: string }>;
  contacts?: Array<{ id?: string; firstName: string; lastName: string; phoneNumber?: string; type: string }>;
}

export async function setYouth(data: SetYouthInput) {
  const { id, firstName, lastName, dateOfBirth, schoolId, gradeLevel, active, addresses, contacts } = data;
  const ageGroup = gradeLevel != null ? (gradeLevel <= 5 ? 'junior_youth' : 'senior_youth') : null;

  let userId: string;

  if (id) {
    const users = await sql<DbRow<Users>[]>`
      INSERT INTO users (id, first_name, last_name, permission, active, created_at, updated_at)
      VALUES (
        ${id},
        ${firstName},
        ${lastName},
        'youth'::permission_level,
        ${active},
        COALESCE((SELECT created_at FROM users WHERE id = ${id}), NOW()),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        active = EXCLUDED.active,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    userId = users[0].id;

    await sql`
      INSERT INTO youth_profiles (user_id, date_of_birth, school_id, grade_level, age_group, created_at, updated_at)
      VALUES (
        ${userId},
        ${dateOfBirth || null},
        ${schoolId || null},
        ${gradeLevel ?? null},
        ${ageGroup},
        COALESCE((SELECT created_at FROM youth_profiles WHERE user_id = ${userId}), NOW()),
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        date_of_birth = EXCLUDED.date_of_birth,
        school_id = EXCLUDED.school_id,
        grade_level = EXCLUDED.grade_level,
        age_group = EXCLUDED.age_group,
        updated_at = EXCLUDED.updated_at
    `;
  } else {
    const newUsers = await sql<DbRow<Users>[]>`
      INSERT INTO users (first_name, last_name, permission, active)
      VALUES (${firstName}, ${lastName}, 'youth'::permission_level, ${active})
      RETURNING *
    `;

    userId = newUsers[0].id;

    await sql`
      INSERT INTO youth_profiles (user_id, date_of_birth, school_id, grade_level, age_group)
      VALUES (${userId}, ${dateOfBirth || null}, ${schoolId || null}, ${gradeLevel ?? null}, ${ageGroup})
    `;
  }

  if (id) {
    await setAddresses(userId, addresses || []);
    await setContacts(userId, contacts || []);
  } else {
    if (addresses && addresses.length > 0) await setAddresses(userId, addresses);
    if (contacts && contacts.length > 0) await setContacts(userId, contacts);
  }

  return getYouth(userId);
}
