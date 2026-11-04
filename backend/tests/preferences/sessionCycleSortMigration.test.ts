import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { asTransactionSql, sql } from '../../src/db/client';

it('renames only valid legacy Session cycle sorting while preserving saved filters and metadata', async () => {
  const rollback = new Error('rollback Session sort preference migration');
  const migration = readFileSync(join(
    process.cwd(), 'db/migrations/2026-11-03_4_preserve_session_cycle_sort_preference.sql',
  ), 'utf8');
  const siblings = { view: 'calendar', search: 'saved search', programIds: ['saved-program'], futureFilter: { enabled: true } };
  const fixtures: Array<{ key: string; value: unknown; expected?: unknown }> = [
    ...(['asc', 'desc'] as const).map(direction => ({
      key: 'session-filters',
      value: { ...siblings, sorting: { key: 'cohort', direction, futureSortOption: 'preserved' } },
      expected: { ...siblings, sorting: { key: 'cycle', direction, futureSortOption: 'preserved' } },
    })),
    { key: 'session-filters', value: { ...siblings, sorting: { key: 'cycle', direction: 'asc' } } },
    { key: 'session-filters', value: { ...siblings, sorting: { key: 'date', direction: 'desc' } } },
    { key: 'unrelated-filters', value: { ...siblings, sorting: { key: 'cohort', direction: 'asc' } } },
    { key: 'session-filters', value: { ...siblings } },
    { key: 'session-filters', value: { sorting: { key: 'cohort' } } },
    { key: 'session-filters', value: { sorting: { key: 'cohort', direction: 'unknown' } } },
    { key: 'session-filters', value: { sorting: { key: 'cohort', direction: null } } },
    { key: 'session-filters', value: { sorting: { key: ['cohort'], direction: 'asc' } } },
    { key: 'session-filters', value: { sorting: 'cohort' } },
    { key: 'session-filters', value: { sorting: [{ key: 'cohort', direction: 'asc' }] } },
    { key: 'session-filters', value: { sorting: null } },
    { key: 'session-filters', value: [{ sorting: { key: 'cohort', direction: 'asc' } }] },
    { key: 'session-filters', value: 'cohort' },
    { key: 'session-filters', value: null },
  ];

  await expect(sql.begin(async rawTx => {
    const trx = asTransactionSql(rawTx);
    const userIds: string[] = [];
    for (const fixture of fixtures) {
      const [user] = await trx<{ id: string }[]>`
        INSERT INTO users (role_id, first_name, last_name)
        VALUES ((SELECT id FROM user_roles WHERE name = 'staff'), 'Synthetic', 'Preference') RETURNING id
      `;
      userIds.push(user.id);
      await trx`
        INSERT INTO user_preferences (user_id, preference_key, value, created_at, updated_at)
        VALUES (${user.id}, ${fixture.key}, ${fixture.value === null ? trx`'null'::jsonb` : trx.json(fixture.value as Parameters<typeof trx.json>[0])},
          '2000-01-01T00:00:00Z', '2001-01-01T00:00:00Z')
      `;
    }

    await trx.unsafe(migration);

    const readPreferences = () => trx<{ userId: string; preferenceKey: string; value: unknown; createdAt: Date; updatedAt: Date }[]>`
      SELECT user_id, preference_key, value, created_at, updated_at FROM user_preferences
      WHERE user_id = ANY(${trx.array(userIds)}::uuid[])
      ORDER BY user_id
    `;
    const rows = await readPreferences();
    expect(rows).toHaveLength(fixtures.length);
    fixtures.forEach((fixture, index) => {
      const row = rows.find(saved => saved.userId === userIds[index]);
      expect(row).toBeDefined();
      expect(row!.preferenceKey).toBe(fixture.key);
      expect(row!.value).toEqual(fixture.expected ?? fixture.value);
      expect(new Date(row!.createdAt).toISOString()).toBe('2000-01-01T00:00:00.000Z');
      expect(new Date(row!.updatedAt).toISOString()).toBe('2001-01-01T00:00:00.000Z');
    });

    await trx.unsafe(migration);
    expect(await readPreferences()).toEqual(rows);

    throw rollback;
  })).rejects.toBe(rollback);
});
