import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Cycle table list', () => {
  let userId: string;
  let token: string;
  let cycleId: string;

  beforeAll(async () => {
    const admin = await seedTestUser({ role: 'admin' });
    userId = admin.userId;
    token = generateToken(userId, 'admin');
    const [cycle] = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (${crypto.randomUUID()}, '9998-01-01', '9998-12-31')
      RETURNING id
    `;
    cycleId = cycle.id;
  });

  afterAll(async () => {
    await sql`DELETE FROM program_cycles WHERE id = ${cycleId}`;
    await deleteTestUser(userId);
  });

  /**
   * Requests cycle rows as the test administrator.
   * @example await list() // the cycle collection response
   */
  const list = () => request(app).get('/api/cycles/list').set('Authorization', `Bearer ${token}`);

  it('returns complete cycle rows with their lifecycle state', async () => {
    const response = await list();
    expect(response.status).toBe(200);
    expect(response.body.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: cycleId, state: 'upcoming', startsOn: '9998-01-01', endsOn: '9998-12-31' }),
    ]));
  });

  it.each([{ cursor: 'bad' }, { limit: 1 }, { sort: 'invalid' }, { direction: 'sideways' }])('rejects invalid cursor-list inputs %j', async query => {
    expect((await list().query(query)).status).toBe(400);
  });

  it('keeps capability checks authoritative', async () => {
    expect((await request(app).get('/api/cycles/list')).status).toBe(401);
    const denied = generateToken(userId, 'admin', undefined, ['write:programs']);
    expect((await request(app).get('/api/cycles/list').set('Authorization', `Bearer ${denied}`)).status).toBe(403);
  });
});
