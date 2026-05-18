import crypto from 'crypto';
import { asTransactionSql, sql } from '../db/client';
import type { Schools, Users, YouthProfiles } from '../types/database';
import type { DbRow } from '../types/db';
import { audit } from './auditService';
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
    INNER JOIN user_roles ur ON ur.id = u.role_id
    LEFT JOIN schools s ON s.id = yp.school_id
    WHERE ur.name = 'youth'
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

export async function setYouth(data: SetYouthInput, actorId: string) {
  const { id, firstName, lastName, dateOfBirth, schoolId, gradeLevel, active, addresses, contacts } = data;
  const ageGroup = gradeLevel != null ? (gradeLevel <= 5 ? 'junior_youth' : 'senior_youth') : null;
  const transactionId = crypto.randomUUID();

  const userId = await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    let persistedUserId: string;

    if (id) {
      const existingUsers = await trx<DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'active'>>[]>`
        SELECT id, first_name, last_name, active
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `;
      const existingProfiles = await trx<DbRow<Pick<YouthProfiles, 'user_id' | 'date_of_birth' | 'school_id' | 'grade_level' | 'age_group'>>[]>`
        SELECT user_id, date_of_birth, school_id, grade_level, age_group
        FROM youth_profiles
        WHERE user_id = ${id}
        LIMIT 1
      `;

      const users = await trx<DbRow<Users>[]>`
        INSERT INTO users (id, first_name, last_name, role_id, active, created_at, updated_at)
        VALUES (
          ${id},
          ${firstName},
          ${lastName},
          (SELECT id FROM user_roles WHERE name = 'youth'),
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

      persistedUserId = users[0].id;
      await audit(
        trx,
        actorId,
        transactionId,
        'users',
        persistedUserId,
        existingUsers.length > 0 ? 'UPDATE' : 'INSERT',
        existingUsers[0]
          ? { id: existingUsers[0].id, firstName: existingUsers[0].firstName, lastName: existingUsers[0].lastName, active: existingUsers[0].active }
          : null,
        { id: users[0].id, firstName: users[0].firstName, lastName: users[0].lastName, active: users[0].active },
      );

      await trx`
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id, grade_level, age_group, created_at, updated_at)
        VALUES (
          ${persistedUserId},
          ${dateOfBirth || null},
          ${schoolId || null},
          ${gradeLevel ?? null},
          ${ageGroup},
          COALESCE((SELECT created_at FROM youth_profiles WHERE user_id = ${persistedUserId}), NOW()),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          date_of_birth = EXCLUDED.date_of_birth,
          school_id = EXCLUDED.school_id,
          grade_level = EXCLUDED.grade_level,
          age_group = EXCLUDED.age_group,
          updated_at = EXCLUDED.updated_at
      `;
      await audit(
        trx,
        actorId,
        transactionId,
        'youth_profiles',
        persistedUserId,
        existingProfiles.length > 0 ? 'UPDATE' : 'INSERT',
        existingProfiles[0]
          ? {
              userId: existingProfiles[0].userId,
              dateOfBirth: existingProfiles[0].dateOfBirth,
              schoolId: existingProfiles[0].schoolId,
              gradeLevel: existingProfiles[0].gradeLevel,
              ageGroup: existingProfiles[0].ageGroup,
            }
          : null,
        { userId: persistedUserId, dateOfBirth: dateOfBirth || null, schoolId: schoolId || null, gradeLevel: gradeLevel ?? null, ageGroup },
      );
    } else {
      const newUsers = await trx<DbRow<Users>[]>`
        INSERT INTO users (first_name, last_name, role_id, active)
        VALUES (${firstName}, ${lastName}, (SELECT id FROM user_roles WHERE name = 'youth'), ${active})
        RETURNING *
      `;

      persistedUserId = newUsers[0].id;
      await audit(trx, actorId, transactionId, 'users', persistedUserId, 'INSERT', null, { id: newUsers[0].id, firstName: newUsers[0].firstName, lastName: newUsers[0].lastName, active: newUsers[0].active });

      await trx`
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id, grade_level, age_group)
        VALUES (${persistedUserId}, ${dateOfBirth || null}, ${schoolId || null}, ${gradeLevel ?? null}, ${ageGroup})
      `;
      await audit(trx, actorId, transactionId, 'youth_profiles', persistedUserId, 'INSERT', null, { userId: persistedUserId, dateOfBirth: dateOfBirth || null, schoolId: schoolId || null, gradeLevel: gradeLevel ?? null, ageGroup });
    }

    if (id) {
      await setAddresses(persistedUserId, addresses || [], actorId, transactionId, trx);
      await setContacts(persistedUserId, contacts || [], actorId, transactionId, trx);
    } else {
      if (addresses && addresses.length > 0) await setAddresses(persistedUserId, addresses, actorId, transactionId, trx);
      if (contacts && contacts.length > 0) await setContacts(persistedUserId, contacts, actorId, transactionId, trx);
    }

    return persistedUserId;
  });

  return getYouth(userId);
}
