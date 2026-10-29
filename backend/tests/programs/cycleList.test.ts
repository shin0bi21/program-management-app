import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Cycle table list', () => {
  let userId: string;
  let token: string;
  let ids: string[];

  beforeAll(async () => {
    const admin = await seedTestUser({ role: 'admin' });
    userId = admin.userId;
    token = generateToken(userId, 'admin');
    const prefix = crypto.randomUUID();
    const rows = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
      SELECT ${prefix} || '-' || number, '9998-01-01', '9998-12-31'
      FROM generate_series(1, 60) AS number RETURNING id
    `;
    ids = rows.map(row => row.id).sort().reverse();
  });

  afterAll(async () => {
    await sql`DELETE FROM program_cycles WHERE id = ANY(${sql.array(ids)}::uuid[])`;
    await deleteTestUser(userId);
  });

  const list = () => request(app).get('/api/cohorts/cycles/list').set('Authorization', `Bearer ${token}`);

  it('paginates cycle rows with a stable ID tie-breaker and complete lifecycle state', async () => {
    const first = await list();
    expect(first.status).toBe(200);
    expect(first.body.rows).toHaveLength(50);
    expect(first.body.rows.map((row: { id: string }) => row.id)).toEqual(ids.slice(0, 50));
    expect(first.body.rows[0]).toEqual(expect.objectContaining({ state: 'upcoming', startsOn: '9998-01-01', endsOn: '9998-12-31' }));

    const second = await list().query({ cursor: first.body.nextCursor });
    expect(second.status).toBe(200);
    expect(second.body.rows.slice(0, 10).map((row: { id: string }) => row.id)).toEqual(ids.slice(50));
    expect(second.body.rows[0]).not.toHaveProperty('cursorValue');
  });

  it.each([{ cursor: 'bad' }, { limit: 51 }, { sort: 'invalid' }, { direction: 'sideways' }])('rejects invalid cursor-list inputs %j', async query => {
    expect((await list().query(query)).status).toBe(400);
  });

  it('keeps capability checks authoritative', async () => {
    expect((await request(app).get('/api/cohorts/cycles/list')).status).toBe(401);
    const denied = generateToken(userId, 'admin', undefined, ['write:programs']);
    expect((await request(app).get('/api/cohorts/cycles/list').set('Authorization', `Bearer ${denied}`)).status).toBe(403);
  });
});
