#!/usr/bin/env node

/** Creates the configured administrator without changing an existing account. */
import postgres from 'postgres';
import { adminSeedConfiguration, seedAdmin } from './helpers/seed-admin';

async function main(): Promise<void> {
  const configuration = adminSeedConfiguration();
  const sql = postgres(configuration.databaseUrl, { max: 1 });

  try {
    const result = await sql.begin(transaction => {
      // Match the application adapter for postgres.js transaction callable typings.
      return seedAdmin(transaction as unknown as typeof sql, configuration);
    });

    if (!result.created) {
      console.log(`Account already exists for ${configuration.email}; credentials were left unchanged.`);
      return;
    }

    console.log(`Admin user created: ${configuration.email}`);
    console.log(`Name: ${configuration.firstName} ${configuration.lastName}`);
    console.log('Admin can now log in with the configured credentials.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (require.main === module) {
  main().catch(() => {
    // Database exceptions may contain query values, including credential material.
    console.error('Admin seeding failed. Verify the database init, DATABASE_URL, and ADMIN_* configuration.');
    process.exitCode = 1;
  });
}
