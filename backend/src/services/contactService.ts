import { asTransactionSql, sql } from '../db/client';
import type { Contacts } from '../types/database';
import type { DbRow } from '../types/db';
import { audit } from './auditService';

type SqlExecutor = typeof sql;

export type ContactInput = {
  id?: string;
  phoneNumber: string;
  type: string;
};

async function syncContacts(trx: SqlExecutor, userId: string, contactsData: ContactInput[], auditUserId: string, transactionId: string) {
  const existingLinks = await trx<{ contactId: string; phoneNumber: string | null; type: string }[]>`
    SELECT uhc.contact_id as "contactId", c.phone_number as "phoneNumber", c.type
    FROM user_has_contacts uhc
    JOIN contacts c ON uhc.contact_id = c.id
    WHERE uhc.user_id = ${userId} AND uhc.active = true
  `;

  const existingContactMap = new Map(
    existingLinks
      .filter(link => link.contactId)
      .map(link => [link.contactId, {
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
          existing.phoneNumber !== contactData.phoneNumber ||
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
    for (const contactId of toDelete) {
      const old = existingContactMap.get(contactId)!;
      await audit(trx, auditUserId, transactionId, 'user_has_contacts', contactId, 'DELETE', { userId, phoneNumber: old.phoneNumber, type: old.type }, null);
    }
  }

  if (toUpdate.length > 0) {
    const ids = toUpdate.map(item => item.id!);
    const phoneNumbers = toUpdate.map(item => item.phoneNumber);
    const types = toUpdate.map(item => item.type);

    await trx`
      UPDATE contacts AS c
      SET
        phone_number = updates.phone_number,
        type = updates.type::contact_type,
        updated_at = NOW()
      FROM (
        SELECT * FROM UNNEST(
          ${trx.array(ids)}::uuid[],
          ${trx.array(phoneNumbers)}::text[],
          ${trx.array(types)}::text[]
        ) AS t(id, phone_number, type)
      ) AS updates
      WHERE c.id = updates.id
    `;
    for (const item of toUpdate) {
      const old = existingContactMap.get(item.id!)!;
      await audit(trx, auditUserId, transactionId, 'contacts', item.id!, 'UPDATE', { userId, phoneNumber: old.phoneNumber, type: old.type }, { userId, phoneNumber: item.phoneNumber, type: item.type });
    }
  }

  for (const contactData of toInsert) {
    const newContacts = await trx<DbRow<Contacts>[]>`
      INSERT INTO contacts (phone_number, type)
      VALUES (${contactData.phoneNumber}, ${contactData.type}::contact_type)
      RETURNING *
    `;

    await trx`
      INSERT INTO user_has_contacts (user_id, contact_id, active)
      VALUES (${userId}, ${newContacts[0].id}, true)
      ON CONFLICT (user_id, contact_id) DO UPDATE SET active = true, updated_at = NOW()
    `;
    await audit(trx, auditUserId, transactionId, 'contacts', newContacts[0].id, 'INSERT', null, { userId, phoneNumber: newContacts[0].phoneNumber, type: newContacts[0].type });
  }
}

export async function setContacts(userId: string, contactsData: ContactInput[], auditUserId: string, transactionId: string, trx?: SqlExecutor) {
  if (trx) {
    await syncContacts(trx, userId, contactsData, auditUserId, transactionId);
    return;
  }

  await sql.begin(async (tx) => {
    await syncContacts(asTransactionSql(tx), userId, contactsData, auditUserId, transactionId);
  });
}
