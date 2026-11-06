import crypto from 'crypto';
import { asTransactionSql, sql } from '../../db/client';
import { InternalServerError, NotFoundError } from '../../errors';
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

/** Loads a required youth profile; an unavailable ID rejects with 404.
 * @example getYouthProfile(youthId) // returns the profile or throws NotFoundError
 */
export async function getYouthProfile(id: string): Promise<YouthRecordRow> {
  const youth = await sql<YouthRecordRow[]>`
    SELECT
      ${youthRecordColumns}
    ${youthRecordFrom}
    WHERE ur.name = 'youth'
      AND u.id = ${id}
    LIMIT 1
  `;
  if (!youth[0]) throw new NotFoundError('Youth profile not found');
  return youth[0];
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

/** Creates a youth or edits an existing youth, including its audit and supplied children.
 * An ID selects a required, locked youth target; it never creates a replacement.
 * @example setYouthProfile({ id: youthId, firstName: 'Sam', lastName: 'Lee' }, actorId)
 */
export async function setYouthProfile(data: SetYouthInput, actorId: string) {
  const { id, firstName, lastName, dateOfBirth, schoolId, addresses, contacts } = data;
  const transactionId = crypto.randomUUID();

  const userId = await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    let persistedUserId: string;

    if (id) {
      const existingUsers = await trx<DbRow<Pick<Users, 'id' | 'first_name' | 'last_name'>>[]>`
        SELECT u.id, u.first_name, u.last_name
        FROM users u
        INNER JOIN user_roles role ON role.id = u.role_id
        WHERE u.id = ${id} AND role.name = 'youth'
        LIMIT 1
        FOR UPDATE OF u
      `;
      const existingProfiles = await trx<DbRow<Pick<YouthProfiles, 'user_id' | 'date_of_birth' | 'school_id'>>[]>`
        SELECT user_id, date_of_birth, school_id
        FROM youth_profiles
        WHERE user_id = ${id}
        LIMIT 1
        FOR UPDATE
      `;

      if (!existingUsers.length || !existingProfiles.length) {
        throw new NotFoundError('Youth profile not found');
      }

      // An omitted DOB preserves the saved value; explicit null represents an unknown DOB.
      const nextDateOfBirth = dateOfBirth === undefined
        ? existingProfiles[0].dateOfBirth
        : dateOfBirth;

      const users = await trx<DbRow<Users>[]>`
        UPDATE users
        SET first_name = ${firstName}, last_name = ${lastName}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      if (!users[0]) throw new InternalServerError('Youth update returned no user');
      persistedUserId = users[0].id;
      await audit(
        trx,
        actorId,
        transactionId,
        'users',
        persistedUserId,
        'UPDATE',
        { id: existingUsers[0].id, firstName: existingUsers[0].firstName, lastName: existingUsers[0].lastName },
        { id: users[0].id, firstName: users[0].firstName, lastName: users[0].lastName },
      );

      await trx`
        UPDATE youth_profiles
        SET date_of_birth = ${nextDateOfBirth}, school_id = ${schoolId || null}, updated_at = NOW()
        WHERE user_id = ${persistedUserId}
      `;
      await audit(
        trx,
        actorId,
        transactionId,
        'youth_profiles',
        persistedUserId,
        'UPDATE',
        {
          userId: existingProfiles[0].userId,
          dateOfBirth: existingProfiles[0].dateOfBirth,
          schoolId: existingProfiles[0].schoolId,
        },
        { userId: persistedUserId, dateOfBirth: nextDateOfBirth, schoolId: schoolId || null },
      );
    } else {
      const newUsers = await trx<DbRow<Users>[]>`
        INSERT INTO users (first_name, last_name, role_id)
        VALUES (${firstName}, ${lastName}, (SELECT id FROM user_roles WHERE name = 'youth'))
        RETURNING *
      `;

      if (!newUsers[0]) throw new InternalServerError('Youth creation returned no user');
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

  return getYouthProfile(userId);
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

  return getYouthProfile(id);
}
