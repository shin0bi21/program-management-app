import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { localImportConfiguration, prepareLocalImport } from '../../db/scripts/import-data';
import { sql } from '../shared/db';

const valid = {
  NODE_ENV: 'development', DISABLE_OUTBOUND: 'true',
  DATABASE_URL: 'postgresql://local:password@db:5432/local_snapshot_20261027_abc',
  ADMIN_EMAIL: 'local@example.test', ADMIN_PASSWORD: 'local-secret',
};

describe('local import preparation guards', () => {
  it('accepts only an isolated local staging database and configured login', () => {
    expect(localImportConfiguration(valid)).toMatchObject({ adminEmail: 'local@example.test' });
  });

  it.each([
    { NODE_ENV: 'production' },
    { DISABLE_OUTBOUND: 'false' },
    { DATABASE_URL: 'postgresql://user:password@production.example/app' },
    { DATABASE_URL: 'postgresql://user:password@db/app' },
    { DATABASE_URL: 'postgresql://user:password@db/local_snapshot_safe?host=production.example' },
    { ADMIN_PASSWORD: '' },
  ])('rejects unsafe preparation configuration %p', overrides => {
    expect(() => localImportConfiguration({ ...valid, ...overrides })).toThrow();
  });
});

describe('local import authentication replacement', () => {
  let database: string;
  let imported: ReturnType<typeof postgres>;
  let databaseUrl: string;

  beforeEach(async () => {
    database = `import_${crypto.randomUUID().replace(/-/g, '')}_test`;
    await sql.unsafe(`CREATE DATABASE "${database}" TEMPLATE template0`);
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${database}`;
    databaseUrl = url.href;
    imported = postgres(databaseUrl, { max: 1 });

    // This isolated database owns every row cleared by the import workflow.
    await imported.unsafe(`
      CREATE TABLE user_roles (id uuid PRIMARY KEY, name text);
      INSERT INTO user_roles VALUES ('00000000-0000-0000-0000-000000000001', 'admin');
      CREATE TABLE users (id uuid PRIMARY KEY, first_name text, last_name text, role_id uuid, updated_at timestamptz);
      CREATE TABLE user_credentials (user_id uuid PRIMARY KEY, email text UNIQUE, password_hash text,
        status text, email_verified boolean, failed_login_attempts integer, locked_until timestamptz,
        last_login timestamptz, updated_at timestamptz);
    `);
    for (const table of ['user_refresh_tokens', 'user_auth_codes', 'user_password_reset_tokens', 'user_trusted_devices', 'system_revoked_tokens']) {
      await imported.unsafe(`CREATE TABLE ${table} (value text); INSERT INTO ${table} VALUES ('copied-token')`);
    }
    await imported`INSERT INTO users (id, first_name) VALUES
      ('00000000-0000-0000-0000-000000000002', 'Preserved')`;
    await imported`INSERT INTO user_credentials (user_id, email, password_hash, status, email_verified)
      VALUES ('00000000-0000-0000-0000-000000000002', 'existing@example.test', 'copied-password', 'inactive', FALSE)`;
  });

  afterEach(async () => {
    await imported?.end({ timeout: 5 });
    if (database) await sql.unsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  });

  const configuration = (email: string) => ({
    databaseUrl, adminEmail: email, adminPassword: 'NewLocalPassword123!',
    adminFirstName: 'Local', adminLastName: 'Administrator',
  });

  it.each(['existing@example.test', 'new@example.test'])('creates or resets %s through shared seeding', async email => {
    await prepareLocalImport(configuration(email));

    const [admin] = await imported`SELECT credentials.*, users.first_name, roles.name AS role
      FROM user_credentials credentials JOIN users ON users.id = credentials.user_id
      JOIN user_roles roles ON roles.id = users.role_id WHERE credentials.email = ${email}`;
    expect(admin).toMatchObject({ status: 'active', email_verified: true, role: 'admin' });
    expect(await bcrypt.compare('NewLocalPassword123!', admin.password_hash)).toBe(true);
    expect(await imported`SELECT * FROM user_refresh_tokens`).toHaveLength(0);
    const [preserved] = await imported`SELECT first_name FROM users
      WHERE id = '00000000-0000-0000-0000-000000000002'`;
    expect(preserved.first_name).toBe('Preserved');
    if (email === 'new@example.test') {
      const [other] = await imported`SELECT password_hash, status FROM user_credentials WHERE email = 'existing@example.test'`;
      expect(other).toEqual({ password_hash: '!local-snapshot-disabled', status: 'inactive' });
    }
  });

  it('rolls back token and password cleanup when administrator seeding fails', async () => {
    await imported`DELETE FROM user_roles`;

    await expect(prepareLocalImport(configuration('new@example.test'))).rejects.toThrow('Admin role not found');

    const [existing] = await imported`SELECT password_hash FROM user_credentials`;
    expect(existing.password_hash).toBe('copied-password');
    expect(await imported`SELECT * FROM user_refresh_tokens`).toHaveLength(1);
    expect(await imported`SELECT * FROM users`).toHaveLength(1);
  });
});
