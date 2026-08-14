import crypto from 'crypto';
import { asTransactionSql, sql } from '../../db/client';
import { NotFoundError } from '../../errors';
import type { Users, YouthProfiles } from '../../types/database';
import type { DbRow } from '../../types/db';
import { audit } from '../shared/auditService';
import { setAddresses } from './youthAddressService';
import { setContacts } from './youthContactService';
import { youthRecordColumns, youthRecordFrom, type YouthRecordRow } from './youthRecordQuery';

// ============================================================================
// QUERIES
// ============================================================================

export async function getYouthProfile(id: string): Promise<YouthRecordRow | null> {
  const youth = await sql<YouthRecordRow[]>`
    SELECT
      ${youthRecordColumns}
    ${youthRecordFrom}
    WHERE ur.name = 'youth'
      AND u.id = ${id}
    LIMIT 1
  `;
  return youth[0] || null;
}

export interface SetYouthInput {
  id?: string;
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth?: string;
  schoolId?: string;
  gradeLevel?: number;
  addresses?: Array<{ id?: string; address: string }>;
  contacts?: Array<{ id?: string; phoneNumber: string; type: string }>;
}

export async function setYouthProfile(data: SetYouthInput, actorId: string) {
  const { id, firstName, lastName, dateOfBirth, schoolId, gradeLevel, addresses, contacts } = data;
  const ageGroup = gradeLevel != null ? (gradeLevel <= 5 ? 'junior_youth' : 'senior_youth') : null;
  const transactionId = crypto.randomUUID();

  const userId = await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    let persistedUserId: string;

    if (id) {
      const existingUsers = await trx<DbRow<Pick<Users, 'id' | 'first_name' | 'last_name'>>[]>`
        SELECT id, first_name, last_name
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
        INSERT INTO users (id, first_name, last_name, role_id, created_at, updated_at)
        VALUES (
          ${id},
          ${firstName},
          ${lastName},
          (SELECT id FROM user_roles WHERE name = 'youth'),
          COALESCE((SELECT created_at FROM users WHERE id = ${id}), NOW()),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
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
          ? { id: existingUsers[0].id, firstName: existingUsers[0].firstName, lastName: existingUsers[0].lastName }
          : null,
        { id: users[0].id, firstName: users[0].firstName, lastName: users[0].lastName },
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
        INSERT INTO users (first_name, last_name, role_id)
        VALUES (${firstName}, ${lastName}, (SELECT id FROM user_roles WHERE name = 'youth'))
        RETURNING *
      `;

      persistedUserId = newUsers[0].id;
      await audit(trx, actorId, transactionId, 'users', persistedUserId, 'INSERT', null, { id: newUsers[0].id, firstName: newUsers[0].firstName, lastName: newUsers[0].lastName });

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

  const savedYouth = await getYouthProfile(userId);
  if (!savedYouth) throw new NotFoundError('Saved youth profile not found');
  return savedYouth;
}
