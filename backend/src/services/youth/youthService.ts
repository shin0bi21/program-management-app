import crypto from 'crypto';
import { asTransactionSql, sql } from '../../db/client';
import { InternalServerError, NotFoundError } from '../../errors';
import type { Users, YouthProfiles } from '../../types/database';
import type { DbRow } from '../../types/db';
import { audit } from '../shared/auditService';
import { setAddresses } from './youthAddressService';
import { setContacts } from './youthContactService';
import type { SetYouthContactsInput } from '../../validation/youthSchemas';
import { getYouthRows, type YouthRow } from './youthRowQuery';

/**
 * Loads one youth profile, including participation, addresses, and contacts.
 * @param id - Youth ID to look up; a missing profile produces a 404 error.
 * @example getYouthProfile(youthId) // returns the profile or throws NotFoundError
 */
export async function getYouthProfile(id: string): Promise<YouthRow> {
  // 1. Load the youth profile.
  const [profile] = await sql<YouthRow[]>`
    ${getYouthRows(sql`youth.id = ${id}`)}
    LIMIT 1
  `;
  if (!profile) throw new NotFoundError('Youth profile not found');
  return profile;
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

/**
 * Creates or updates a youth profile and saves its addresses, contacts, and audit history.
 * An ID selects a required, locked youth target; it never creates a replacement.
 * @param data - Validated profile fields. Omit id to create a youth; include it to update one.
 * @param currentUserId - ID of the signed-in user to record in the audit history.
 * @returns The saved profile with its current participation, addresses, and contacts.
 * @example setYouthProfile({ id: youthId, firstName: 'Sam', lastName: 'Lee' }, currentUserId)
 */
export async function setYouthProfile(data: SetYouthInput, currentUserId: string) {
  // 1. Prepare the profile change.
  const { id, firstName, lastName, dateOfBirth, schoolId, addresses, contacts } = data;
  const transactionId = crypto.randomUUID();

  const userId = await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    let persistedUserId: string;

    // 2. Update the locked profile or create a new one.
    if (id) {
      const existingUsers = await trx<DbRow<Pick<Users, 'id' | 'first_name' | 'last_name'>>[]>`
        SELECT youth.id, youth.first_name, youth.last_name
        FROM users youth
        INNER JOIN user_roles role ON role.id = youth.role_id
        WHERE youth.id = ${id} AND role.name = 'youth'
        LIMIT 1
        FOR UPDATE OF youth
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
        currentUserId,
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
        currentUserId,
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
        VALUES (${firstName}, ${lastName}, (
          SELECT id
          FROM user_roles
          WHERE name = 'youth'
        ))
        RETURNING *
      `;

      if (!newUsers[0]) throw new InternalServerError('Youth creation returned no user');
      persistedUserId = newUsers[0].id;
      await audit(trx, currentUserId, transactionId, 'users', persistedUserId, 'INSERT', null, { id: newUsers[0].id, firstName: newUsers[0].firstName, lastName: newUsers[0].lastName });

      await trx`
        INSERT INTO youth_profiles (user_id, date_of_birth, school_id)
        VALUES (${persistedUserId}, ${dateOfBirth ?? null}, ${schoolId || null})
      `;
      await audit(trx, currentUserId, transactionId, 'youth_profiles', persistedUserId, 'INSERT', null, { userId: persistedUserId, dateOfBirth: dateOfBirth ?? null, schoolId: schoolId || null });
    }

    // 3. Save the supplied addresses and contacts.
    if (id) {
      await setAddresses(persistedUserId, addresses || [], currentUserId, transactionId, trx);
      await setContacts(persistedUserId, contacts || [], currentUserId, transactionId, trx);
    } else {
      if (addresses && addresses.length > 0) await setAddresses(persistedUserId, addresses, currentUserId, transactionId, trx);
      if (contacts && contacts.length > 0) await setContacts(persistedUserId, contacts, currentUserId, transactionId, trx);
    }

    return persistedUserId;
  });

  // 4. Return the saved profile.
  return getYouthProfile(userId);
}

/**
 * Replaces a youth's contacts after checking submitted contact IDs.
 * @param id - ID of the youth whose contacts should be replaced.
 * @param data - Complete list of contacts to keep; an empty list removes all active contacts.
 * @param currentUserId - ID of the signed-in user to record in the audit history.
 * @example setYouthContacts(youthId, data, currentUserId)
 */
export async function setYouthContacts(id: string, data: SetYouthContactsInput, currentUserId: string) {
  const transactionId = crypto.randomUUID();

  // 1. Normalize the submitted contact IDs.
  const contacts = data.contacts.map(contact => ({
    ...contact,
    ...(contact.id ? { id: contact.id.toLowerCase() } : {}),
  }));

  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Lock the youth profile.
    const profiles = await trx`
      SELECT profile.user_id
      FROM youth_profiles profile
      INNER JOIN users youth ON youth.id = profile.user_id
      INNER JOIN user_roles role ON role.id = youth.role_id
      WHERE profile.user_id = ${id} AND role.name = 'youth'
      FOR UPDATE OF profile
    `;
    if (!profiles.length) throw new NotFoundError('Youth profile not found');

    // 3. Check that submitted contacts belong to this youth.
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

    // 4. Save the replacement contacts.
    await setContacts(id, contacts, currentUserId, transactionId, trx);
  });

  // 5. Return the saved profile.
  return getYouthProfile(id);
}
