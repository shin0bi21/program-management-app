import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { asTransactionSql } from '../../src/db/client';
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

  it('removes only layout fields from all users and preference keys during migration', async () => {
    const rollback = new Error('rollback layout preference migration test');
    const migration = readFileSync(join(
      process.cwd(),
      'db/migrations/2026-10-30_1_remove_table_layout_preferences.sql',
    ), 'utf8');
    const accountPreferences = {
      view: 'table',
      search: 'planning',
      sorting: { key: 'title', direction: 'asc' },
      staffIds: [firstUserId],
      futureFilter: { hiddenColumns: ['nested-value-is-not-table-layout'] },
    };

    await expect(sql.begin(async rawTx => {
      const trx = asTransactionSql(rawTx);
      const fixtures = [
        { userId: firstUserId, key: 'task-preferences', value: { ...accountPreferences, columnWidths: { title: 280 }, hiddenColumns: ['program'] } },
        { userId: secondUserId, key: 'retired-preference-key', value: { ...accountPreferences, columnWidths: null, hiddenColumns: 'malformed' } },
        { userId: firstUserId, key: 'layout-only', value: { columnWidths: {}, hiddenColumns: [] } },
        { userId: secondUserId, key: 'unaffected-preferences', value: accountPreferences },
      ];

      for (const fixture of fixtures) {
        await trx`
          INSERT INTO user_preferences (user_id, preference_key, value, updated_at)
          VALUES (${fixture.userId}, ${fixture.key}, ${trx.json(fixture.value)}, '2000-01-01T00:00:00Z')
          ON CONFLICT (user_id, preference_key) DO UPDATE
          SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
        `;
      }

      await trx.unsafe(migration);

      for (const fixture of fixtures) {
        const [row] = await trx<Array<{ value: object; updatedAt: Date }>>`
          SELECT value, updated_at FROM user_preferences
          WHERE user_id = ${fixture.userId} AND preference_key = ${fixture.key}
        `;
        expect(row.value).toEqual(fixture.key === 'layout-only' ? {} : accountPreferences);
        if (fixture.key === 'unaffected-preferences') {
          expect(new Date(row.updatedAt).toISOString()).toBe('2000-01-01T00:00:00.000Z');
        }
      }

      const [remaining] = await trx<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count FROM user_preferences
        WHERE value ? 'columnWidths' OR value ? 'hiddenColumns'
      `;
      expect(remaining.count).toBe(0);
      throw rollback;
    })).rejects.toBe(rollback);
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

  it('renames the persisted task list view to the table view', async () => {
    const rollback = new Error('rollback task list view migration test');
    const migration = readFileSync(join(
      process.cwd(),
      'db/migrations/2026-08-25_1_rename_task_list_view.sql',
    ), 'utf8');

    await expect(sql.begin(async rawTx => {
      const trx = asTransactionSql(rawTx);
      await trx`
        INSERT INTO user_preferences (user_id, preference_key, value)
        VALUES (
          ${firstUserId},
          'task-preferences',
          ${trx.json({ view: 'list', staffIds: [] })}
        )
        ON CONFLICT (user_id, preference_key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = NOW()
      `;

      for (const statement of migration.split(';').map(part => part.trim()).filter(Boolean)) {
        await trx.unsafe(statement);
      }

      const [preference] = await trx<Array<{ value: { view: string; staffIds: string[] } }>>`
        SELECT value
        FROM user_preferences
        WHERE user_id = ${firstUserId}
          AND preference_key = 'task-preferences'
      `;
      expect(preference.value).toEqual({ view: 'table', staffIds: [] });
      throw rollback;
    })).rejects.toBe(rollback);
  });

  it('restores migrated in-progress task filters through the supported preference API', async () => {
    const user = await seedTestUser({ role: 'staff' });
    const token = generateToken(user.userId, user.role, user.email);
    const migration = readFileSync(join(
      process.cwd(),
      'db/migrations/2026-10-30_3_rename_task_preference_active_status.sql',
    ), 'utf8');
    const value = {
      view: 'table',
      statuses: ['upcoming', 'active', 'overdue'],
      search: 'preserved task search',
      sorting: { key: 'status', direction: 'asc' },
    };

    try {
      await sql`
        INSERT INTO user_preferences (user_id, preference_key, value)
        VALUES (${user.userId}, 'task-preferences', ${sql.json(value)})
      `;

      await sql.unsafe(migration);
      const restored = await request(app)
        .get('/api/preferences/task-preferences')
        .set('Authorization', `Bearer ${token}`);

      expect(restored.status).toBe(200);
      expect(restored.body).toEqual({ ...value, statuses: ['upcoming', 'in_progress', 'overdue'] });
    } finally {
      await deleteTestUser(user.userId);
    }
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
