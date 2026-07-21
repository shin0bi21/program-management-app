#!/usr/bin/env node

import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

const fixtureId = '10000000-0000-4000-8000-000000000001';
const sql = postgres(databaseUrl);

async function main() {
  const rows = await sql.begin(async (rawTx) => {
    const tx = rawTx as unknown as typeof sql;
    // This command intentionally resets only its reserved fixture, including a
    // prior conversion, so the same conversion flow can be tested repeatedly.
    await tx`DELETE FROM leads WHERE expression_of_interest_id = ${fixtureId}`;

    return tx`
      INSERT INTO expressions_of_interest (
      id,
      youth_first_name,
      youth_last_name,
      age,
      school,
      contact_first_name,
      contact_last_name,
      contact_phone_number,
      contact_relationship,
      discovery_source,
      notes
      ) VALUES (
      ${fixtureId},
      'Avery',
      'Outreach',
      14,
      'Outreach Test School',
      'Jordan',
      'Outreach',
      '416-555-0142',
      'guardian',
      'community_outreach',
      'Deterministic submission for testing lead conversion.'
      )
      ON CONFLICT (id) DO UPDATE SET
        youth_first_name = EXCLUDED.youth_first_name,
        youth_last_name = EXCLUDED.youth_last_name,
        age = EXCLUDED.age,
        school = EXCLUDED.school,
        contact_first_name = EXCLUDED.contact_first_name,
        contact_last_name = EXCLUDED.contact_last_name,
        contact_phone_number = EXCLUDED.contact_phone_number,
        contact_relationship = EXCLUDED.contact_relationship,
        discovery_source = EXCLUDED.discovery_source,
        notes = EXCLUDED.notes,
        status = 'new',
        status_updated_at = NOW(),
        updated_at = NOW()
      RETURNING id, status
    `;
  });

  console.log(`Expression-of-interest fixture ready: ${rows[0].id} (${rows[0].status})`);
}

main()
  .catch((error) => {
    console.error('ERROR: Failed to seed expressions-of-interest fixture');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
