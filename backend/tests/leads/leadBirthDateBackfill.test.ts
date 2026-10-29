import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { asTransactionSql, sql } from '../../src/db/client';

it('backfills only missing signed-up Lead DOBs from linked profiles and is safe to repeat', async () => {
  const rollback = new Error('rollback Lead DOB backfill fixtures');
  const migration = readFileSync(join(
    process.cwd(), 'db/migrations/2026-10-28_3_backfill_lead_birth_dates_from_youth.sql',
  ), 'utf8');

  await expect(sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const cases = [
      { name: 'Missing', profileDate: '2012-01-01', leadDate: null, status: 'signed_up', expected: '2012-01-01' },
      { name: 'Known', profileDate: '2012-01-01', leadDate: '2011-02-02', status: 'signed_up', expected: '2011-02-02' },
      { name: 'Unknown', profileDate: null, leadDate: null, status: 'signed_up', expected: null },
      { name: 'Unsigned', profileDate: '2012-01-01', leadDate: null, status: 'new', expected: null },
    ];
    const ids: string[] = [];

    for (const scenario of cases) {
      const [user] = await trx<{ id: string }[]>`
        INSERT INTO users (first_name, last_name, role_id)
        VALUES (${scenario.name}, 'DOBBackfill', (SELECT id FROM user_roles WHERE name = 'youth'))
        RETURNING id
      `;
      await trx`
        INSERT INTO youth_profiles (user_id, date_of_birth)
        VALUES (${user.id}, ${scenario.profileDate})
      `;
      const [lead] = await trx<{ id: string }[]>`
        INSERT INTO leads (
          origin, submitted_by_role, youth_first_name, youth_last_name, school,
          contact_phone_number, contact_relationship, discovery_source, status,
          converted_youth_id, date_of_birth
        ) VALUES (
          'internal', 'staff', ${scenario.name}, 'DOBBackfill', 'Test School',
          '416-555-0101', 'parent', 'school', ${scenario.status}, ${user.id}, ${scenario.leadDate}
        ) RETURNING id
      `;
      ids.push(lead.id);
    }

    await trx.unsafe(migration);
    const rows = await trx<{ id: string; dateOfBirth: string | null; school: string; status: string }[]>`
      SELECT id, date_of_birth::text AS date_of_birth, school, status
      FROM leads WHERE id = ANY(${trx.array(ids)}::uuid[]) ORDER BY id
    `;

    cases.forEach((scenario, index) => {
      expect(rows.find(row => row.id === ids[index])).toEqual({
        id: ids[index], dateOfBirth: scenario.expected, school: 'Test School', status: scenario.status,
      });
    });

    await trx.unsafe(migration);
    const repeated = await trx<{ id: string; dateOfBirth: string | null; school: string; status: string }[]>`
      SELECT id, date_of_birth::text AS date_of_birth, school, status
      FROM leads WHERE id = ANY(${trx.array(ids)}::uuid[]) ORDER BY id
    `;
    expect(repeated).toEqual(rows);

    throw rollback;
  })).rejects.toBe(rollback);
});
