import { sql } from '../shared/db';
import { buildSessionFilters } from '../../src/services/programming/sessions/sessionRowFilters';
import type { SessionRow } from '../../src/services/programming/sessions/sessionRowQuery';

const firstId = '00000000-0000-4000-8000-000000000011';
const secondId = '00000000-0000-4000-8000-000000000012';
const excludedId = '00000000-0000-4000-8000-000000000013';

it('leaves the source rows unrestricted when IDs are omitted', async () => {
  const rows = await buildSessionFilters(sessionRows(), {});

  expect(rows.map(row => row.id).sort()).toEqual([firstId, secondId]);
});

it('matches no rows for an explicitly empty ID filter', async () => {
  expect(await buildSessionFilters(sessionRows(), { ids: [] })).toEqual([]);
});

it('intersects IDs with other filters and cannot introduce rows absent from the source', async () => {
  const rows = await buildSessionFilters(sessionRows(), {
    ids: [firstId, secondId, excludedId], sessionTypes: ['Guest Speaker'], search: 'Beta',
  });
  const excluded = await buildSessionFilters(sessionRows(), { ids: [excludedId] });

  expect(rows).toEqual([expect.objectContaining({ id: secondId, theme: 'Beta', sessionType: 'Guest Speaker' })]);
  expect(excluded).toEqual([]);
});

/**
 * Supplies canonical session rows with two IDs for isolated SQL filter assertions.
 * @returns An unexecuted projection with no persistent fixture records.
 * @example await sessionRows() // Alpha (Regular) and Beta (Guest Speaker)
 */
function sessionRows() {
  return sql<SessionRow[]>`
    SELECT
      fixture.id,
      fixture.theme,
      NOW() + INTERVAL '1 day' AS starts_at,
      NOW() + INTERVAL '1 day 1 hour' AS ends_at,
      NULL::timestamptz AS cancelled_at,
      NULL::text AS description,
      '00000000-0000-4000-8000-000000000001'::uuid AS cycle_id,
      fixture.session_type,

      'Cycle'::text AS cycle,

      '00000000-0000-4000-8000-000000000002'::uuid AS program_id,
      'Program'::text AS program,
      TRUE AS enrollment_required,

      'upcoming'::text AS state
    FROM (VALUES
      (${firstId}::uuid, 'Alpha', 'Regular'::session_type),
      (${secondId}::uuid, 'Beta', 'Guest Speaker'::session_type)
    ) fixture(id, theme, session_type)
  `;
}
