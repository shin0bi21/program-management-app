import { asTransactionSql, sql } from '../db/client';
import type { Contacts } from '../types/database';
import type { DbRow } from '../types/db';

export type ContactInput = {
  id?: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  type: string;
};

export async function setContacts(userId: string, contactsData: ContactInput[]) {
  await sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    const existingLinks = await trx<{ contactId: string; firstName: string; lastName: string; phoneNumber: string | null; type: string }[]>`
      SELECT uhc.contact_id as "contactId", c.first_name as "firstName", c.last_name as "lastName", c.phone_number as "phoneNumber", c.type
      FROM user_has_contacts uhc
      JOIN contacts c ON uhc.contact_id = c.id
      WHERE uhc.user_id = ${userId} AND uhc.active = true
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

    const toInsert: ContactInput[] = [];
    const toUpdate: ContactInput[] = [];
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
      await trx`
        UPDATE user_has_contacts
        SET active = false, updated_at = NOW()
        WHERE user_id = ${userId} AND contact_id IN ${trx(toDelete)}
      `;
    }

    if (toUpdate.length > 0) {
      const ids = toUpdate.map(item => item.id!);
      const firstNames = toUpdate.map(item => item.firstName);
      const lastNames = toUpdate.map(item => item.lastName);
      const phoneNumbers = toUpdate.map(item => item.phoneNumber || null);
      const types = toUpdate.map(item => item.type);

      await trx`
        UPDATE contacts AS c
        SET
          first_name = updates.first_name,
          last_name = updates.last_name,
          phone_number = updates.phone_number,
          type = updates.type::contact_type,
          updated_at = NOW()
        FROM (
          SELECT * FROM UNNEST(
            ${trx.array(ids)}::uuid[],
            ${trx.array(firstNames)}::text[],
            ${trx.array(lastNames)}::text[],
            ${trx.array(phoneNumbers)}::text[],
            ${trx.array(types)}::text[]
          ) AS t(id, first_name, last_name, phone_number, type)
        ) AS updates
        WHERE c.id = updates.id
      `;
    }

    for (const contactData of toInsert) {
      const newContacts = await trx<DbRow<Contacts>[]>`
        INSERT INTO contacts (first_name, last_name, phone_number, type)
        VALUES (${contactData.firstName}, ${contactData.lastName}, ${contactData.phoneNumber || null}, ${contactData.type}::contact_type)
        RETURNING *
      `;

      await trx`
        INSERT INTO user_has_contacts (user_id, contact_id, active)
        VALUES (${userId}, ${newContacts[0].id}, true)
        ON CONFLICT (user_id, contact_id) DO UPDATE SET active = true, updated_at = NOW()
      `;
    }
  });
}
