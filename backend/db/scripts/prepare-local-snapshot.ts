import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import postgres from 'postgres';

interface LocalSnapshotConfiguration {
  databaseUrl: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

export function localSnapshotConfiguration(env: NodeJS.ProcessEnv): LocalSnapshotConfiguration {
  if (env.NODE_ENV !== 'development') {
    throw new Error('Snapshot preparation requires NODE_ENV=development');
  }
  if (env.DISABLE_OUTBOUND !== 'true') {
    throw new Error('Snapshot preparation requires DISABLE_OUTBOUND=true');
  }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const databaseUrl = new URL(env.DATABASE_URL);
  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol)
    || databaseUrl.hostname !== 'db'
    || (databaseUrl.port !== '' && databaseUrl.port !== '5432')
    || !/^\/local_snapshot_[a-z0-9_]+$/.test(databaseUrl.pathname)
    || databaseUrl.search !== ''
    || databaseUrl.hash !== ''
  ) {
    throw new Error('Snapshot preparation only accepts a staging database named local_snapshot_* on db:5432');
  }
  if (!env.ADMIN_EMAIL?.trim() || !env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured for the local administrator');
  }

  return {
    databaseUrl: env.DATABASE_URL,
    adminEmail: env.ADMIN_EMAIL.trim(),
    adminPassword: env.ADMIN_PASSWORD,
    adminFirstName: env.ADMIN_FIRST_NAME || 'Local',
    adminLastName: env.ADMIN_LAST_NAME || 'Administrator',
  };
}

export async function prepareLocalSnapshot(configuration: LocalSnapshotConfiguration) {
  const sql = postgres(configuration.databaseUrl, { max: 1 });
  const passwordHash = await bcrypt.hash(configuration.adminPassword, 10);

  try {
    await sql.begin(async tx => {
      // Match the application transaction adapter for the postgres.js callable-typing issue.
      const trx = tx as unknown as typeof sql;
      const [role] = await trx<{ id: string }[]>`SELECT id FROM user_roles WHERE name = 'admin'`;
      if (!role) throw new Error('The restored database has no administrator role');

      // Discard all copied authentication material while preserving business records and account state.
      await trx`TRUNCATE user_refresh_tokens, user_auth_codes, user_password_reset_tokens,
        user_trusted_devices, system_revoked_tokens`;
      await trx`UPDATE user_credentials SET password_hash = '!local-snapshot-disabled',
        failed_login_attempts = 0, locked_until = NULL, last_login = NULL, updated_at = NOW()`;

      const [existing] = await trx<{ userId: string }[]>`
        SELECT user_id AS "userId" FROM user_credentials
        WHERE lower(email) = lower(${configuration.adminEmail}) FOR UPDATE
      `;
      if (existing) {
        await trx`UPDATE users SET role_id = ${role.id}, updated_at = NOW() WHERE id = ${existing.userId}`;
        await trx`UPDATE user_credentials SET password_hash = ${passwordHash}, status = 'active',
          email_verified = TRUE, updated_at = NOW() WHERE user_id = ${existing.userId}`;
      } else {
        const adminId = crypto.randomUUID();
        await trx`INSERT INTO users (id, first_name, last_name, role_id)
          VALUES (${adminId}, ${configuration.adminFirstName}, ${configuration.adminLastName}, ${role.id})`;
        await trx`INSERT INTO user_credentials (user_id, email, password_hash, email_verified, status)
          VALUES (${adminId}, ${configuration.adminEmail}, ${passwordHash}, TRUE, 'active')`;
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (require.main === module) {
  Promise.resolve().then(() => localSnapshotConfiguration(process.env)).then(prepareLocalSnapshot).then(() => {
    console.log('Local snapshot authentication prepared. Only the configured local administrator can sign in.');
  }).catch(() => {
    // Database exceptions can include restored values; keep production data out of terminal logs.
    console.error('Local snapshot preparation failed. Verify the staging database and local administrator configuration.');
    process.exitCode = 1;
  });
}
