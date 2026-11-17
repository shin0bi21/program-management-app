import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import * as emailService from '../../src/utils/emailService';
import { asTransactionSql } from '../../src/db/client';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';
import { insertResetToken } from '../auth/helpers';

const app = createApp();
const password = 'ReplacementPassword123!';
let invitationEmail: jest.SpiedFunction<typeof emailService.sendYouthInvite>;

interface YouthAccountFixture {
  youthId: string;
  authorization: string;
}

beforeEach(() => {
  invitationEmail = jest.spyOn(emailService, 'sendYouthInvite').mockResolvedValue(undefined);
});

afterEach(() => invitationEmail.mockRestore());

it('rejects revoked invitation and reset links after reinviting the same youth to another address', async () => {
  await withYouthAccount(async fixture => {
    const originalToken = await inviteYouth(fixture, `original-${crypto.randomUUID()}@test.local`);
    const originalReset = await insertResetToken(fixture.youthId);

    const revoked = await request(app).delete(`/api/accounts/${fixture.youthId}`)
      .set('Authorization', fixture.authorization);
    expect(revoked.status).toBe(200);

    const remainingTokens = await sql`SELECT id FROM user_password_reset_tokens WHERE user_id = ${fixture.youthId}`;
    const replacementEmail = `replacement-${crypto.randomUUID()}@test.local`;
    const replacementToken = await inviteYouth(fixture, replacementEmail);
    const oldLinkStatuses: number[] = [];

    for (const token of [originalToken, originalReset]) {
      const response = await request(app).post('/api/auth/reset-password')
        .send({ token, newPassword: password });
      oldLinkStatuses.push(response.status);
    }

    const [account] = await sql<{ email: string; status: string }[]>`
      SELECT email, status FROM user_credentials WHERE user_id = ${fixture.youthId}
    `;
    expect({ oldLinkStatuses, account }).toEqual({
      oldLinkStatuses: [400, 400],
      account: { email: replacementEmail, status: 'invited' },
    });
    expect(remainingTokens).toHaveLength(0);

    const activated = await request(app).post('/api/auth/reset-password')
      .send({ token: replacementToken, newPassword: password });
    expect(activated.status).toBe(200);
    const [saved] = await sql<{ status: string; profileId: string }[]>`
      SELECT uc.status, yp.user_id AS profile_id
      FROM user_credentials uc JOIN youth_profiles yp ON yp.user_id = uc.user_id
      WHERE uc.user_id = ${fixture.youthId}
    `;
    expect(saved).toEqual({ status: 'active', profileId: fixture.youthId });
  });
});

it('rejects a reset without credentials and rolls back its token claim', async () => {
  await withYouthAccount(async fixture => {
    const token = await insertResetToken(fixture.youthId);

    const response = await request(app).post('/api/auth/reset-password')
      .send({ token, newPassword: password });

    expect(response.status).toBe(400);
    const [stored] = await sql<{ usedAt: Date | null }[]>`
      SELECT used_at FROM user_password_reset_tokens WHERE user_id = ${fixture.youthId}
    `;
    expect(stored.usedAt).toBeNull();
  });
});

it.each(['activation', 'revocation'] as const)('preserves the result when %s wins the account lock', async winner => {
  await withYouthAccount(async fixture => {
    const token = await inviteYouth(fixture, `race-${crypto.randomUUID()}@test.local`);
    const operations = [
      () => request(app).post('/api/auth/reset-password')
        .send({ token, newPassword: password }).then(response => response),
      () => request(app).delete(`/api/accounts/${fixture.youthId}`)
        .set('Authorization', fixture.authorization).then(response => response),
    ];
    if (winner === 'revocation') operations.reverse();

    const responses = await runQueuedRequests(fixture.youthId, operations);
    const [activation, revocation] = winner === 'activation' ? responses : [...responses].reverse();
    expect(activation.status).toBe(winner === 'activation' ? 200 : 400);
    expect(revocation.status).toBe(winner === 'activation' ? 409 : 200);

    const credentials = await sql<{ status: string; passwordHash: string }[]>`
      SELECT status, password_hash FROM user_credentials WHERE user_id = ${fixture.youthId}
    `;
    if (winner === 'activation') {
      expect(credentials[0].status).toBe('active');
      expect(await bcrypt.compare(password, credentials[0].passwordHash)).toBe(true);
    } else {
      expect(credentials).toHaveLength(0);
    }
    const profiles = await sql`SELECT user_id FROM youth_profiles WHERE user_id = ${fixture.youthId}`;
    expect(profiles).toHaveLength(1);
  });
});

it('does not issue a password-reset link when revocation wins before issuance', async () => {
  await withYouthAccount(async fixture => {
    const email = `forgot-${crypto.randomUUID()}@test.local`;
    await inviteYouth(fixture, email);
    const resetEmail = jest.spyOn(emailService, 'sendEmail').mockResolvedValue(undefined);

    try {
      const [revocation, forgotten] = await runQueuedRequests(fixture.youthId, [
        () => request(app).delete(`/api/accounts/${fixture.youthId}`)
          .set('Authorization', fixture.authorization).then(response => response),
        () => request(app).post('/api/auth/forgot-password')
          .send({ email }).then(response => response),
      ]);

      expect(revocation.status).toBe(200);
      expect(forgotten.status).toBe(200);
      expect(resetEmail).not.toHaveBeenCalled();
      const tokens = await sql`SELECT id FROM user_password_reset_tokens WHERE user_id = ${fixture.youthId}`;
      expect(tokens).toHaveLength(0);
    } finally {
      resetEmail.mockRestore();
    }
  });
});

it('consumes an activation link only once when password resets overlap', async () => {
  await withYouthAccount(async fixture => {
    const token = await inviteYouth(fixture, `single-use-${crypto.randomUUID()}@test.local`);
    const otherPassword = 'AnotherReplacement123!';

    const responses = await runQueuedRequests(fixture.youthId, [password, otherPassword].map(newPassword =>
      () => request(app).post('/api/auth/reset-password')
        .send({ token, newPassword }).then(response => response),
    ));

    expect(responses.map(response => response.status)).toEqual([200, 400]);
    const [credentials] = await sql<{ passwordHash: string }[]>`
      SELECT password_hash FROM user_credentials WHERE user_id = ${fixture.youthId}
    `;
    expect(await bcrypt.compare(password, credentials.passwordHash)).toBe(true);
    expect(await bcrypt.compare(otherPassword, credentials.passwordHash)).toBe(false);
  });
});

/**
 * Runs a scenario with a credential-free youth profile and a staff user, then removes both users.
 * @example withYouthAccount(async fixture => { await inviteYouth(fixture, 'alex@test.local'); });
 */
async function withYouthAccount(run: (fixture: YouthAccountFixture) => Promise<void>): Promise<void> {
  const userIds: string[] = [];
  try {
    const user = await seedTestUser({ role: 'staff' });
    userIds.push(user.userId);
    const youth = await seedTestUser({ role: 'youth' });
    userIds.push(youth.userId);
    await sql`DELETE FROM user_credentials WHERE user_id = ${youth.userId}`;
    await sql`INSERT INTO youth_profiles (user_id) VALUES (${youth.userId})`;

    await run({
      youthId: youth.userId,
      authorization: `Bearer ${generateToken(user.userId, 'staff', user.email)}`,
    });
  } finally {
    for (const userId of userIds.reverse()) await deleteTestUser(userId);
  }
}

/**
 * Invites the fixture's youth through the API and captures the activation link sent to the chosen address.
 * @example inviteYouth(fixture, 'alex@test.local') returns the raw token for that invitation.
 */
async function inviteYouth(fixture: YouthAccountFixture, email: string): Promise<string> {
  const response = await request(app).post(`/api/youth/${fixture.youthId}/invite`)
    .set('Authorization', fixture.authorization)
    .send({ email });
  expect(response.status).toBe(201);

  const delivery = invitationEmail.mock.calls.at(-1);
  if (!delivery) throw new Error('No invitation email was captured');
  expect(delivery[0]).toBe(email);
  const token = new URL(delivery[2]).searchParams.get('token');
  if (!token) throw new Error('Invitation email did not contain an activation token');
  return token;
}

/**
 * Queues API operations behind an invited user's row lock in the supplied order, then releases them.
 * Database waiters establish ordering; all requests settle before fixture cleanup, including on failure.
 * @example runQueuedRequests(youthId, [activate, revoke]) makes activation enter first.
 */
async function runQueuedRequests(
  youthId: string,
  operations: Array<() => Promise<request.Response>>,
): Promise<request.Response[]> {
  let signalReady!: (pid: number) => void;
  let rejectReady!: (error: unknown) => void;
  let release!: () => void;
  const ready = new Promise<number>((resolve, reject) => { signalReady = resolve; rejectReady = reject; });
  const released = new Promise<void>(resolve => { release = resolve; });
  const requests: Array<Promise<request.Response>> = [];
  const blocker = sql.begin(async rawTx => {
    const tx = asTransactionSql(rawTx);
    await tx`SET LOCAL lock_timeout = '3s'`;
    await tx`SELECT id FROM users WHERE id = ${youthId} FOR UPDATE`;
    const [connection] = await tx<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    signalReady(connection.pid);
    await released;
  });
  void blocker.catch(rejectReady);

  try {
    const pid = await ready;
    for (const operation of operations) {
      requests.push(operation());
      await waitForBlockedRequests(pid, requests.length);
    }
    const [before] = await sql<{ status: string }[]>`
      SELECT status FROM user_credentials WHERE user_id = ${youthId}
    `;
    expect(before.status).toBe('invited');

    release();
    await blocker;
    return await Promise.all(requests);
  } finally {
    release();
    await Promise.allSettled([blocker, ...requests]);
  }
}

/**
 * Waits for a known number of database requests to queue behind the blocker, following row-lock chains.
 * Rejects after three seconds if the requested number has not arrived.
 * @example waitForBlockedRequests(blockerPid, 2) confirms both API operations reached the barrier.
 */
async function waitForBlockedRequests(blockerPid: number, count: number): Promise<void> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const [waiting] = await sql<{ count: number }[]>`
      WITH RECURSIVE blocked AS (
        SELECT activity.pid, ARRAY[activity.pid] AS path
        FROM pg_stat_activity activity
        WHERE ${blockerPid} = ANY(pg_blocking_pids(activity.pid))
        UNION ALL
        SELECT activity.pid, blocked.path || activity.pid
        FROM pg_stat_activity activity
        INNER JOIN blocked ON blocked.pid = ANY(pg_blocking_pids(activity.pid))
        WHERE NOT activity.pid = ANY(blocked.path)
      )
      SELECT COUNT(DISTINCT pid)::int AS count FROM blocked
    `;
    if (waiting.count === count) return;
    // Poll observed database readiness; elapsed time does not decide which operation wins.
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Expected ${count} requests to reach the account lock`);
}
