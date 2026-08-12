import request from 'supertest';
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

  it('persists the sessions view with its filters', async () => {
    const value = {
      view: 'list',
      programIds: [],
      cohortId: null,
      sessionTypeIds: [],
      statuses: ['upcoming'],
    };

    const saved = await request(app)
      .put('/api/preferences/session-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send(value);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(value);

    const restored = await request(app)
      .get('/api/preferences/session-filters')
      .set('Authorization', `Bearer ${firstToken}`);
    expect(restored.body).toEqual(value);
  });

  it('persists the Timesheets view with its filters and selected cycle', async () => {
    const value = {
      view: 'list',
      staffIds: [],
      programIds: ['general'],
      categories: ['meeting'],
      types: ['session'],
      cycleId: '00000000-0000-4000-8000-000000000001',
      sorting: { key: 'session', direction: 'asc' },
      columnWidths: { firstName: 180, lastName: 200, session: 220, type: 120 },
    };
    const saved = await request(app)
      .put('/api/preferences/timesheet-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send(value);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(value);

    const restored = await request(app)
      .get('/api/preferences/timesheet-filters')
      .set('Authorization', `Bearer ${firstToken}`);
    expect(restored.body).toEqual(value);
  });

  it('persists bounded column widths and validated hidden columns', async () => {
    const value = {
      statuses: [],
      roles: [],
      columnWidths: { name: 180, email: 320 },
      hiddenColumns: ['email'],
    };
    const saved = await request(app)
      .put('/api/preferences/account-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send(value);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(value);

    for (const columnWidths of [{ actions: 120 }, { name: 99 }, { name: 501 }, { name: 120.5 }]) {
      const rejected = await request(app)
        .put('/api/preferences/account-filters')
        .set('Authorization', `Bearer ${firstToken}`)
        .send({ statuses: [], roles: [], columnWidths });
      expect(rejected.status).toBe(400);
    }

    const rejectedHiddenColumns = await request(app)
      .put('/api/preferences/account-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ statuses: [], roles: [], hiddenColumns: ['actions'] });
    expect(rejectedHiddenColumns.status).toBe(400);
  });

  it('persists separate Outreach first and last name column widths', async () => {
    const preferences = [
      {
        key: 'lead-filters',
        value: { statuses: [], programIds: [], columnWidths: { firstName: 180, lastName: 200 } },
      },
      {
        key: 'expression-interest-filters',
        value: { statuses: [], programIds: [], columnWidths: { firstName: 170, lastName: 210 } },
      },
    ] as const;

    for (const { key, value } of preferences) {
      const saved = await request(app)
        .put(`/api/preferences/${key}`)
        .set('Authorization', `Bearer ${firstToken}`)
        .send(value);
      expect(saved.status).toBe(200);
      expect(saved.body).toEqual(value);
    }
  });

  it('persists separate task assignee first and last name column widths', async () => {
    const value = {
      view: 'list', staffIds: [], programIds: [], categories: [], statuses: [],
      sorting: { key: 'lastName', direction: 'desc' },
      columnWidths: { firstName: 180, lastName: 200 },
    };
    const saved = await request(app)
      .put('/api/preferences/task-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send(value);

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(value);
  });

  it('rejects unknown preference keys and malformed filter values', async () => {
    expect((await request(app)
      .get('/api/preferences/unknown')
      .set('Authorization', `Bearer ${firstToken}`)).status).toBe(400);

    expect((await request(app)
      .put('/api/preferences/youth-profile-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ statuses: ['unknown'], programIds: [] })).status).toBe(400);
  });
});
