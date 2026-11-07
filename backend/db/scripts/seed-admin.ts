#!/usr/bin/env node

/** Creates the configured administrator without changing an existing account. */
import postgres from 'postgres';
import { adminSeedConfiguration, seedAdmin } from './helpers/seed-admin';

/**
 * Creates the configured administrator in one transaction, reports whether it already existed, and always closes its connection.
 * @example // npm run seed:admin preserves an existing account's credentials.
 */
async function main(): Promise<void> {
  // 1. Require complete administrator configuration before opening the connection.
  const configuration = adminSeedConfiguration();
  const sql = postgres(configuration.databaseUrl, { max: 1 });

  try {
    // 2. Seed inside one transaction, preserving existing accounts by default.
    const result = await sql.begin(transaction => {
      // Match the application adapter for postgres.js transaction callable typings.
      return seedAdmin(transaction as unknown as typeof sql, configuration);
    });

    // 3. Report whether the administrator was created or already existed.
    if (!result.created) {
      console.log(`Account already exists for ${configuration.email}; credentials were left unchanged.`);
      return;
    }

    console.log(`Admin user created: ${configuration.email}`);
    console.log(`Name: ${configuration.firstName} ${configuration.lastName}`);
    console.log('Admin can now log in with the configured credentials.');
  } finally {
    // 4. Close the owned connection on every path.
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
