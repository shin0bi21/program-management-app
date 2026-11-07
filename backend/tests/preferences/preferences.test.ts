import request from 'supertest';
import { preferenceKeySchema } from '../../src/validation/preferenceSchemas';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('User preferences API', () => {
  let firstUserId: string;
  let firstToken: string;
  let secondUserId: string;
  let secondToken: string;

  beforeAll(async () => {
    const first = await seedTestUser({ role: 'staff' });
    const second = await seedTestUser({ role: 'staff' });
    firstUserId = first.userId;
    secondUserId = second.userId;
    firstToken = generateToken(first.userId, first.role, first.email);
    secondToken = generateToken(second.userId, second.role, second.email);
  });

  afterAll(async () => {
    await deleteTestUser(firstUserId);
    await deleteTestUser(secondUserId);
  });

  it('returns null before the current user saves a preference', async () => {
    const response = await request(app)
      .get('/api/preferences/youth-profile-filters')
      .set('Authorization', `Bearer ${firstToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
  });

  it('persists validated filters independently for each user', async () => {
    const [program] = await sql<{ id: string }[]>`
      SELECT id FROM programs ORDER BY name LIMIT 1
    `;
    const value = { statuses: ['inactive'], programIds: [program.id] };

    const saved = await request(app)
      .put('/api/preferences/youth-profile-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send(value);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(value);

    const restored = await request(app)
      .get('/api/preferences/youth-profile-filters')
      .set('Authorization', `Bearer ${firstToken}`);
    expect(restored.body).toEqual(value);

    const otherUser = await request(app)
      .get('/api/preferences/youth-profile-filters')
      .set('Authorization', `Bearer ${secondToken}`);
    expect(otherUser.body).toBeNull();
  });

  it.each(preferenceKeySchema.options)('discards browser-local layout when saving %s', async key => {
    const accountPreferences = {
      search: 'planning',
      statuses: ['active'],
      sorting: { key: 'name', direction: 'desc' },
      futureFilter: { enabled: true },
    };
    const saved = await request(app)
      .put(`/api/preferences/${key}`)
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ ...accountPreferences, columnWidths: { name: 180 }, hiddenColumns: ['email'] });

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(accountPreferences);

    const restored = await request(app)
      .get(`/api/preferences/${key}`)
      .set('Authorization', `Bearer ${firstToken}`);
    expect(restored.body).toEqual(accountPreferences);

    const [row] = await sql<Array<{ value: typeof accountPreferences }>>`
      SELECT value FROM user_preferences
      WHERE user_id = ${firstUserId} AND preference_key = ${key}
    `;
    expect(row.value).toEqual(accountPreferences);
  });

  it('rejects unknown preference keys and non-object preference values', async () => {
    expect((await request(app)
      .get('/api/preferences/unknown')
      .set('Authorization', `Bearer ${firstToken}`)).status).toBe(400);

    expect((await request(app)
      .put('/api/preferences/youth-profile-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send([])).status).toBe(400);
  });
});
