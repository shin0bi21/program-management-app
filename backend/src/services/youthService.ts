import crypto from 'crypto';
import { asTransactionSql, sql } from '../db/client';
import { NotFoundError } from '../errors';
import type { Schools, Users, YouthProfiles } from '../types/database';
import type { YouthQuery } from '../validation/youthSchemas';
import type { DbRow } from '../types/db';
import { audit } from './auditService';
import { setAddresses } from './addressService';
import { setContacts } from './contactService';
import { applyYouthFilters } from './queryFilters/youthFilters';

type YouthRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'created_at'>> &
  DbRow<Pick<YouthProfiles, 'date_of_birth' | 'school_id' | 'program_id' | 'notes' | 'grade_level' | 'age_group' | 'status'>> &
  DbRow<Pick<Schools, 'name'>> & {
    programName: string | null;
    account: { email: string; status: 'invited' | 'active' | 'inactive' } | null;
  };

// ============================================================================
// QUERIES
// ============================================================================

export function getYouth(id: string): Promise<YouthRow | null>;
export function getYouth(id?: undefined, filters?: YouthQuery): Promise<YouthRow[]>;
export async function getYouth(id?: string, filters?: YouthQuery): Promise<YouthRow[] | YouthRow | null> {
  const where = filters ? applyYouthFilters(filters) : sql`TRUE`;
  const youth = await sql<YouthRow[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      yp.status,
      yp.date_of_birth,
      yp.school_id,
      s.name as school_name,
      yp.program_id,
      p.name as program_name,
      yp.notes,
      yp.grade_level,
      yp.age_group,
      CASE WHEN uc.user_id IS NULL THEN NULL ELSE json_build_object(
        'email', uc.email,
        'status', uc.status
      ) END AS account,
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
    LEFT JOIN programs p ON p.id = yp.program_id
    LEFT JOIN user_credentials uc ON uc.user_id = u.id
    WHERE ur.name = 'youth'
      ${id ? sql`AND u.id = ${id}` : sql``}
      AND ${where}
    ORDER BY u.first_name ASC, u.last_name ASC
  `;
  return id ? youth[0] || null : youth;
}

export interface SetYouthInput {
  id?: string;
  firstName: string;
  lastName: string;
  email?: string;
  status: 'active' | 'inactive';
  dateOfBirth?: string;
  schoolId?: string;
  programId?: string | null;
  notes?: string | null;
  gradeLevel?: number;
  addresses?: Array<{ id?: string; address: string; city: string; province: string; postalCode: string }>;
  contacts?: Array<{ id?: string; firstName: string; lastName: string; phoneNumber?: string; type: string }>;
}

export async function setYouth(data: SetYouthInput, actorId: string) {
  const { id, firstName, lastName, dateOfBirth, schoolId, programId, notes, gradeLevel, status, addresses, contacts } = data;
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
      const existingProfiles = await trx<DbRow<Pick<YouthProfiles, 'user_id' | 'date_of_birth' | 'school_id' | 'program_id' | 'notes' | 'grade_level' | 'age_group' | 'status'>>[]>`
        SELECT user_id, date_of_birth, school_id, program_id, notes, grade_level, age_group, status
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
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id, program_id, notes, grade_level, age_group, status, created_at, updated_at)
        VALUES (
          ${persistedUserId},
          ${dateOfBirth || null},
          ${schoolId || null},
          ${programId ?? null},
          ${notes ?? null},
          ${gradeLevel ?? null},
          ${ageGroup},
          ${status},
          COALESCE((SELECT created_at FROM youth_profiles WHERE user_id = ${persistedUserId}), NOW()),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          date_of_birth = EXCLUDED.date_of_birth,
          school_id = EXCLUDED.school_id,
          program_id = EXCLUDED.program_id,
          notes = EXCLUDED.notes,
          grade_level = EXCLUDED.grade_level,
          age_group = EXCLUDED.age_group,
          status = EXCLUDED.status,
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
              programId: existingProfiles[0].programId,
              notes: existingProfiles[0].notes,
              gradeLevel: existingProfiles[0].gradeLevel,
              ageGroup: existingProfiles[0].ageGroup,
              status: existingProfiles[0].status,
            }
          : null,
        { userId: persistedUserId, dateOfBirth: dateOfBirth || null, schoolId: schoolId || null, programId: programId ?? null, notes: notes ?? null, gradeLevel: gradeLevel ?? null, ageGroup, status },
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
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id, program_id, notes, grade_level, age_group, status)
        VALUES (${persistedUserId}, ${dateOfBirth || null}, ${schoolId || null}, ${programId ?? null}, ${notes ?? null}, ${gradeLevel ?? null}, ${ageGroup}, ${status})
      `;
      await audit(trx, actorId, transactionId, 'youth_profiles', persistedUserId, 'INSERT', null, { userId: persistedUserId, dateOfBirth: dateOfBirth || null, schoolId: schoolId || null, programId: programId ?? null, notes: notes ?? null, gradeLevel: gradeLevel ?? null, ageGroup, status });
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

  const savedYouth = await getYouth(userId);
  if (!savedYouth) throw new NotFoundError('Saved youth profile not found');
  return savedYouth;
}

export async function toggleYouthStatus(youthId: string, actorId: string) {
  const transactionId = crypto.randomUUID();

  await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    const existing = await trx<(DbRow<Pick<Users, 'id' | 'first_name' | 'last_name'>> & { status: 'active' | 'inactive' })[]>`
      SELECT u.id, u.first_name, u.last_name, yp.status
      FROM users u
      INNER JOIN youth_profiles yp ON yp.user_id = u.id
      INNER JOIN user_roles ur ON ur.id = u.role_id
      WHERE u.id = ${youthId} AND ur.name = 'youth'
      LIMIT 1
    `;
    if (!existing.length) throw new NotFoundError('Youth profile not found');

    const prev = existing[0];
    const newStatus = prev.status === 'active' ? 'inactive' : 'active';

    await trx`
      UPDATE youth_profiles SET status = ${newStatus}, updated_at = NOW()
      WHERE user_id = ${youthId}
    `;

    await audit(
      trx, actorId, transactionId, 'youth_profiles', youthId, 'UPDATE',
      { userId: prev.id, status: prev.status },
      { userId: prev.id, status: newStatus }
    );
  });

  return getYouth(youthId);
}
