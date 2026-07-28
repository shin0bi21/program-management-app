import { asTransactionSql, sql } from '../db/client';
import type { Addresses } from '../types/database';
import type { DbRow } from '../types/db';
import { audit } from './auditService';

type SqlExecutor = typeof sql;

export type AddressInput = {
  id?: string;
  address: string;
};

async function syncAddresses(trx: SqlExecutor, userId: string, addressesData: AddressInput[], auditUserId: string, transactionId: string) {
  const existingLinks = await trx<{ addressId: string; address: string }[]>`
    SELECT uha.address_id as "addressId", a.address
    FROM user_has_addresses uha
    JOIN addresses a ON uha.address_id = a.id
    WHERE uha.user_id = ${userId} AND uha.active = true
  `;

  const existingAddressMap = new Map(
    existingLinks
      .filter(link => link.addressId)
      .map(link => [link.addressId, {
        address: link.address,
      }]),
  );

  const toInsert: AddressInput[] = [];
  const toUpdate: AddressInput[] = [];
  const requestedIds = new Set<string>();

  for (const addressData of addressesData) {
    if (addressData.id) {
      requestedIds.add(addressData.id);
      const existing = existingAddressMap.get(addressData.id);
      if (existing) {
        const hasChanged = existing.address !== addressData.address;
        if (hasChanged) toUpdate.push(addressData);
      }
    } else {
      toInsert.push(addressData);
    }
  }

  const toDelete = [...existingAddressMap.keys()].filter(id => !requestedIds.has(id));

  if (toDelete.length > 0) {
    await trx`
      UPDATE user_has_addresses
      SET active = false, updated_at = NOW()
      WHERE user_id = ${userId} AND address_id IN ${trx(toDelete)}
    `;
    for (const addressId of toDelete) {
      const old = existingAddressMap.get(addressId)!;
      await audit(trx, auditUserId, transactionId, 'user_has_addresses', addressId, 'DELETE', { userId, address: old.address }, null);
    }
  }

  if (toUpdate.length > 0) {
    const ids = toUpdate.map(item => item.id!);
    const addresses = toUpdate.map(item => item.address);

    await trx`
      UPDATE addresses AS a
      SET
        address = updates.address,
        updated_at = NOW()
      FROM (
        SELECT * FROM UNNEST(
          ${trx.array(ids)}::uuid[],
          ${trx.array(addresses)}::text[]
        ) AS t(id, address)
      ) AS updates
      WHERE a.id = updates.id
    `;
    for (const item of toUpdate) {
      const old = existingAddressMap.get(item.id!)!;
      await audit(trx, auditUserId, transactionId, 'addresses', item.id!, 'UPDATE', { userId, address: old.address }, { userId, address: item.address });
    }
  }

  for (const addressData of toInsert) {
    const newAddresses = await trx<DbRow<Addresses>[]>`
      INSERT INTO addresses (address)
      VALUES (${addressData.address})
      RETURNING *
    `;

    await trx`
      INSERT INTO user_has_addresses (user_id, address_id, active)
      VALUES (${userId}, ${newAddresses[0].id}, true)
      ON CONFLICT (user_id, address_id) DO UPDATE SET active = true, updated_at = NOW()
    `;
    await audit(trx, auditUserId, transactionId, 'addresses', newAddresses[0].id, 'INSERT', null, { userId, address: newAddresses[0].address });
  }
}

export async function setAddresses(userId: string, addressesData: AddressInput[], auditUserId: string, transactionId: string, trx?: SqlExecutor) {
  if (trx) {
    await syncAddresses(trx, userId, addressesData, auditUserId, transactionId);
    return;
  }

  await sql.begin(async (tx) => {
    await syncAddresses(asTransactionSql(tx), userId, addressesData, auditUserId, transactionId);
  });
}
