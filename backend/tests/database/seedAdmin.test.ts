import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import postgres from 'postgres';
import { seedAdmin, type AdminConfiguration } from '../../db/scripts/helpers/seed-admin';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';

const userIds: string[] = [];
const marker = `AdminSeed-${crypto.randomUUID()}`;
const seedConnection = postgres(process.env.DATABASE_URL!, { max: 2 });
const configuration = (email: string) => ({
  email,
  password: 'SeedAdminPassword123!',
  firstName: marker,
  lastName: 'Test',
});

function seedInTransaction(configuration: AdminConfiguration) {
  return seedConnection.begin(transaction => seedAdmin(transaction as unknown as typeof seedConnection, configuration));
}

afterAll(async () => {
  await seedConnection.end({ timeout: 5 });
});

afterEach(async () => {
  const markedUsers = await sql<{ id: string }[]>`SELECT id FROM users WHERE first_name = ${marker}`;
  const createdIds = new Set([...userIds.splice(0), ...markedUsers.map(user => user.id)]);
  for (const id of createdIds) await deleteTestUser(id);
});

it('concurrent and repeated seed runs create one account without changing its password', async () => {
  const email = `admin-seed-${crypto.randomUUID()}@test.local`;
  const settings = configuration(email);
  const results = await Promise.all([seedInTransaction(settings), seedInTransaction(settings)]);
  userIds.push(...new Set(results.map(result => result.userId)));

  expect(results.filter(result => result.created)).toHaveLength(1);
  expect(results[0].userId).toBe(results[1].userId);

  const [original] = await sql<{ passwordHash: string }[]>`
    SELECT password_hash FROM user_credentials WHERE email = ${email}
  `;
  const repeated = await seedInTransaction({ ...settings, password: 'DifferentPassword123!', firstName: 'Changed' });
  const accounts = await sql<{ userId: string; passwordHash: string; firstName: string; role: string }[]>`
    SELECT credentials.user_id, credentials.password_hash, users.first_name, roles.name AS role
    FROM user_credentials credentials
    JOIN users ON users.id = credentials.user_id
    JOIN user_roles roles ON roles.id = users.role_id
    WHERE credentials.email = ${email}
  `;

  expect(repeated).toEqual({ created: false, userId: results[0].userId });
  expect(accounts).toHaveLength(1);
  expect(accounts[0]).toMatchObject({
    userId: results[0].userId, passwordHash: original.passwordHash, firstName: marker, role: 'admin',
  });
  expect(await bcrypt.compare(settings.password, accounts[0].passwordHash)).toBe(true);
});

it('leaves an existing non-admin account unchanged', async () => {
  const user = await seedTestUser({ role: 'staff' });
  userIds.push(user.userId);
  const [original] = await sql<{ passwordHash: string }[]>`
    SELECT password_hash FROM user_credentials WHERE user_id = ${user.userId}
  `;

  const result = await seedInTransaction(configuration(user.email));
  const [account] = await sql<{ passwordHash: string; role: string }[]>`
    SELECT credentials.password_hash, roles.name AS role
    FROM user_credentials credentials
    JOIN users ON users.id = credentials.user_id
    JOIN user_roles roles ON roles.id = users.role_id
    WHERE credentials.user_id = ${user.userId}
  `;

  expect(result).toEqual({ created: false, userId: user.userId });
  expect(account).toEqual({ passwordHash: original.passwordHash, role: 'staff' });
});
