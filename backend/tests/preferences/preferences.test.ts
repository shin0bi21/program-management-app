import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { asTransactionSql } from '../../src/db/client';
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

  it('persists the Hours view with its filters and selected cycle', async () => {
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
      .put('/api/preferences/hours-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send(value);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(value);

    const restored = await request(app)
      .get('/api/preferences/hours-filters')
      .set('Authorization', `Bearer ${firstToken}`);
    expect(restored.body).toEqual(value);
  });

  it('persists frontend-owned table presentation values', async () => {
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

    const presentationColumns = await request(app)
      .put('/api/preferences/account-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ statuses: [], roles: [], columnWidths: { actions: 120 }, hiddenColumns: ['actions'] });
    expect(presentationColumns.status).toBe(200);
    expect(presentationColumns.body).toEqual({
      statuses: [],
      roles: [],
      columnWidths: { actions: 120 },
      hiddenColumns: ['actions'],
    });
  });

  it('stores preference contents as frontend-owned JSON', async () => {
    const legacyValue = {
      statuses: [],
      programIds: [],
      columnWidths: { youthName: 260, school: 220 },
      hiddenColumns: ['youthName', 'school'],
    };
    await sql`
      INSERT INTO user_preferences (user_id, preference_key, value)
      VALUES (${firstUserId}, 'expression-interest-filters', ${sql.json(legacyValue)})
      ON CONFLICT (user_id, preference_key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW()
    `;

    const restored = await request(app)
      .get('/api/preferences/expression-interest-filters')
      .set('Authorization', `Bearer ${firstToken}`);
    expect(restored.status).toBe(200);
    expect(restored.body).toEqual(legacyValue);

    const saved = await request(app)
      .put('/api/preferences/expression-interest-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send(legacyValue);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(legacyValue);

    const futureValue = {
      ...legacyValue,
      futureFilter: { enabled: true },
      columnWidths: { futureColumn: 99 },
    };
    const savedFutureValue = await request(app)
      .put('/api/preferences/expression-interest-filters')
      .set('Authorization', `Bearer ${firstToken}`)
      .send(futureValue);
    expect(savedFutureValue.status).toBe(200);
    expect(savedFutureValue.body).toEqual(futureValue);
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
      .put('/api/preferences/task-preferences')
      .set('Authorization', `Bearer ${firstToken}`)
      .send(value);

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(value);
  });

  it('migrates task preferences to the preferences key without changing their value', async () => {
    const rollback = new Error('rollback task preference migration test');
    const migration = readFileSync(join(
      process.cwd(),
      'db/migrations/2026-08-24_1_rename_task_preferences.sql',
    ), 'utf8');
    const value = {
      view: 'table',
      search: 'planning',
      staffIds: [firstUserId],
      hiddenColumns: ['program'],
      columnWidths: { title: 280 },
    };

    await expect(sql.begin(async rawTx => {
      const trx = asTransactionSql(rawTx);
      await trx`
        DELETE FROM user_preferences
        WHERE user_id = ${firstUserId}
          AND preference_key IN ('task-filters', 'task-preferences')
      `;
      await trx`
        INSERT INTO user_preferences (user_id, preference_key, value)
        VALUES (${firstUserId}, 'task-filters', ${trx.json(value)})
      `;

      for (const statement of migration.split(';').map(part => part.trim()).filter(Boolean)) {
        await trx.unsafe(statement);
      }

      const rows = await trx<Array<{ preferenceKey: string; value: typeof value }>>`
        SELECT preference_key, value
        FROM user_preferences
        WHERE user_id = ${firstUserId}
          AND preference_key IN ('task-filters', 'task-preferences')
      `;
      expect(rows).toEqual([{ preferenceKey: 'task-preferences', value }]);
      throw rollback;
    })).rejects.toBe(rollback);
  });

  it('keeps the most recently updated task preference when both keys exist', async () => {
    const rollback = new Error('rollback duplicate task preference migration test');
    const migration = readFileSync(join(
      process.cwd(),
      'db/migrations/2026-08-24_1_rename_task_preferences.sql',
    ), 'utf8');
    const legacyValue = { view: 'calendar', search: 'legacy' };
    const currentValue = { view: 'table', search: 'current' };

    await expect(sql.begin(async rawTx => {
      const trx = asTransactionSql(rawTx);
      await trx`
        DELETE FROM user_preferences
        WHERE user_id = ${firstUserId}
          AND preference_key IN ('task-filters', 'task-preferences')
      `;
      await trx`
        INSERT INTO user_preferences (user_id, preference_key, value, updated_at)
        VALUES
          (${firstUserId}, 'task-filters', ${trx.json(legacyValue)}, NOW() - INTERVAL '1 hour'),
          (${firstUserId}, 'task-preferences', ${trx.json(currentValue)}, NOW())
      `;

      for (const statement of migration.split(';').map(part => part.trim()).filter(Boolean)) {
        await trx.unsafe(statement);
      }

      const rows = await trx<Array<{ preferenceKey: string; value: typeof currentValue }>>`
        SELECT preference_key, value
        FROM user_preferences
        WHERE user_id = ${firstUserId}
          AND preference_key IN ('task-filters', 'task-preferences')
      `;
      expect(rows).toEqual([{ preferenceKey: 'task-preferences', value: currentValue }]);
      throw rollback;
    })).rejects.toBe(rollback);
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
