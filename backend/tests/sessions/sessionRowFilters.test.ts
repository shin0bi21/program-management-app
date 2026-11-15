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

  expect(rows).toEqual([expect.objectContaining({ id: secondId, title: 'Beta', sessionType: 'Guest Speaker' })]);
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
      fixture.title,
      (CURRENT_DATE + 1)::text AS date,
      '17:00'::text AS start_time, '19:00'::text AS end_time,
      NULL::timestamptz AS cancelled_at,
      NULL::text AS description,
      '00000000-0000-4000-8000-000000000001'::uuid AS cycle_id,
      fixture.session_type,

      'Cycle'::text AS cycle,

      '00000000-0000-4000-8000-000000000002'::uuid AS program_id,
      'Program'::text AS program,
      TRUE AS enrollment_required,

      'upcoming'::text AS state,
      TRUE AS movable
    FROM (VALUES
      (${firstId}::uuid, 'Alpha', 'Regular'::session_type),
      (${secondId}::uuid, 'Beta', 'Guest Speaker'::session_type)
    ) fixture(id, title, session_type)
  `;
}
