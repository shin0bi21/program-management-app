import { sql } from '../db/client';
import type { Addresses } from '../types/database';
import type { DbRow } from '../types/db';

export type AddressInput = {
  id?: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
};

export async function setAddresses(userId: string, addressesData: AddressInput[]) {
  const existingLinks = await sql<{ addressId: string; address: string; city: string; province: string; postalCode: string }[]>`
    SELECT uha.address_id as "addressId", a.address, a.city, a.province, a.postal_code as "postalCode"
    FROM user_has_addresses uha
    JOIN addresses a ON uha.address_id = a.id
    WHERE uha.user_id = ${userId} AND uha.active = true
  `;

  const existingAddressMap = new Map(
    existingLinks
      .filter(link => link.addressId)
      .map(link => [link.addressId, {
        address: link.address,
        city: link.city,
        province: link.province,
        postalCode: link.postalCode,
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
        const hasChanged =
          existing.address !== addressData.address ||
          existing.city !== addressData.city ||
          existing.province !== addressData.province ||
          existing.postalCode !== addressData.postalCode;
        if (hasChanged) toUpdate.push(addressData);
      }
    } else {
      toInsert.push(addressData);
    }
  }

  const toDelete = [...existingAddressMap.keys()].filter(id => !requestedIds.has(id));

  if (toDelete.length > 0) {
    await sql`
      UPDATE user_has_addresses
      SET active = false, updated_at = NOW()
      WHERE user_id = ${userId} AND address_id IN ${sql(toDelete)}
    `;
  }

  if (toUpdate.length > 0) {
    const ids = toUpdate.map(item => item.id!);
    const addresses = toUpdate.map(item => item.address);
    const cities = toUpdate.map(item => item.city);
    const provinces = toUpdate.map(item => item.province);
    const postalCodes = toUpdate.map(item => item.postalCode);

    await sql`
      UPDATE addresses AS a
      SET
        address = updates.address,
        city = updates.city,
        province = updates.province,
        postal_code = updates.postal_code,
        updated_at = NOW()
      FROM (
        SELECT * FROM UNNEST(
          ${sql.array(ids)}::uuid[],
          ${sql.array(addresses)}::text[],
          ${sql.array(cities)}::text[],
          ${sql.array(provinces)}::text[],
          ${sql.array(postalCodes)}::text[]
        ) AS t(id, address, city, province, postal_code)
      ) AS updates
      WHERE a.id = updates.id
    `;
  }

  for (const addressData of toInsert) {
    const newAddresses = await sql<DbRow<Addresses>[]>`
      INSERT INTO addresses (address, city, province, postal_code, country)
      VALUES (${addressData.address}, ${addressData.city}, ${addressData.province}, ${addressData.postalCode}, 'Canada')
      RETURNING *
    `;

    await sql`
      INSERT INTO user_has_addresses (user_id, address_id, active)
      VALUES (${userId}, ${newAddresses[0].id}, true)
      ON CONFLICT (user_id, address_id) DO UPDATE SET active = true, updated_at = NOW()
    `;
  }
}
