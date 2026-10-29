import crypto from 'crypto';
import { asTransactionSql, sql } from '../../db/client';
import { NotFoundError } from '../../errors';
import type { Users, YouthProfiles } from '../../types/database';
import type { DbRow } from '../../types/db';
import { audit } from '../shared/auditService';
import { setAddresses } from './youthAddressService';
import { setContacts } from './youthContactService';
import type { SetYouthContactsInput } from '../../validation/youthSchemas';
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
  dateOfBirth?: string | null;
  schoolId?: string;
  addresses?: Array<{ id?: string; address: string }>;
  contacts?: Array<{ id?: string; phoneNumber: string; type: string }>;
}

export async function setYouthProfile(data: SetYouthInput, actorId: string) {
  const { id, firstName, lastName, dateOfBirth, schoolId, addresses, contacts } = data;
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
      const existingProfiles = await trx<DbRow<Pick<YouthProfiles, 'user_id' | 'date_of_birth' | 'school_id'>>[]>`
        SELECT user_id, date_of_birth, school_id
        FROM youth_profiles
        WHERE user_id = ${id}
        LIMIT 1
        FOR UPDATE
      `;

      // An omitted DOB preserves the saved value; explicit null represents an unknown DOB.
      const nextDateOfBirth = dateOfBirth === undefined
        ? existingProfiles[0]?.dateOfBirth ?? null
        : dateOfBirth;

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
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id, created_at, updated_at)
        VALUES (
          ${persistedUserId},
          ${nextDateOfBirth},
          ${schoolId || null},
          COALESCE((SELECT created_at FROM youth_profiles WHERE user_id = ${persistedUserId}), NOW()),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          date_of_birth = EXCLUDED.date_of_birth,
          school_id = EXCLUDED.school_id,
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
            }
          : null,
        { userId: persistedUserId, dateOfBirth: nextDateOfBirth, schoolId: schoolId || null },
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
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id)
        VALUES (${persistedUserId}, ${dateOfBirth ?? null}, ${schoolId || null})
      `;
      await audit(trx, actorId, transactionId, 'youth_profiles', persistedUserId, 'INSERT', null, { userId: persistedUserId, dateOfBirth: dateOfBirth ?? null, schoolId: schoolId || null });
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


export async function setYouthContacts(id: string, data: SetYouthContactsInput, actorId: string) {
  const transactionId = crypto.randomUUID();
  const contacts = data.contacts.map(contact => ({
    ...contact,
    ...(contact.id ? { id: contact.id.toLowerCase() } : {}),
  }));

  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const profiles = await trx`
      SELECT yp.user_id
      FROM youth_profiles yp
      INNER JOIN users u ON u.id = yp.user_id
      INNER JOIN user_roles role ON role.id = u.role_id
      WHERE yp.user_id = ${id} AND role.name = 'youth'
      FOR UPDATE OF yp
    `;
    if (!profiles.length) throw new NotFoundError('Youth profile not found');

    const activeContacts = await trx<{ contactId: string }[]>`
      SELECT contact_id
      FROM user_has_contacts
      WHERE user_id = ${id} AND active = true
    `;
    const activeContactIds = new Set(activeContacts.map(contact => contact.contactId));
    const hasUnavailableContact = contacts.some(contact => (
      contact.id !== undefined && !activeContactIds.has(contact.id)
    ));
    if (hasUnavailableContact) throw new NotFoundError('One or more youth contacts were not found');

    await setContacts(id, contacts, actorId, transactionId, trx);
  });

  const savedYouth = await getYouthProfile(id);
  if (!savedYouth) throw new NotFoundError('Saved youth profile not found');
  return savedYouth;
}
