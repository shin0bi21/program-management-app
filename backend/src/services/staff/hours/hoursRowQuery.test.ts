import { sql } from '../../../db/client';
import { createHoursFixture, clearHoursRecords, deleteHoursFixture, type HoursFixture } from '../../../../tests/shared/hoursFixtures';
import { getHoursRows } from './hoursRowQuery';

describe('Canonical Hours rows', () => {
  let fixture: HoursFixture;
  beforeAll(async () => { fixture = await createHoursFixture(); });
  afterEach(async () => { await clearHoursRecords(fixture); });
  afterAll(async () => { await deleteHoursFixture(fixture); });

  it('enforces own/shared staff scope even when a caller supplies a broad predicate', async () => {
    const { admin, firstStaff, secondStaff, unrelatedStaff, activeCycleId, programId, date } = fixture;
    const entries = await sql<Array<{ id: string; staffId: string }>>`
      INSERT INTO time_entries (staff_id, program_id, cycle_id, category, date, hours, note) VALUES
        (${firstStaff.userId}, ${programId}, ${activeCycleId}, 'meeting', ${date}, 1, 'Own'),
        (${secondStaff.userId}, ${programId}, ${activeCycleId}, 'meeting', ${date}, 1, 'Shared'),
        (${unrelatedStaff.userId}, ${programId}, ${activeCycleId}, 'meeting', ${date}, 1, 'Unrelated')
      RETURNING id, staff_id
    `;
    const visibleIds = entries.filter(entry => entry.staffId !== unrelatedStaff.userId).map(entry => entry.id).sort();
    const hiddenId = entries.find(entry => entry.staffId === unrelatedStaff.userId)!.id;
    expect((await getHoursRows(firstStaff.auth)).map(row => row.id).sort()).toEqual(visibleIds);
    expect(await getHoursRows(firstStaff.auth, sql`entry.id = ${hiddenId}`)).toEqual([]);
    expect((await getHoursRows(firstStaff.auth, sql`TRUE OR entry.id = ${hiddenId}`)).map(row => row.id).sort()).toEqual(visibleIds);
    expect((await getHoursRows(admin.auth)).map(row => row.id).sort()).toEqual(entries.map(entry => entry.id).sort());
    expect(await getHoursRows(unrelatedStaff.auth)).toEqual([
      expect.objectContaining({ id: hiddenId, staffId: unrelatedStaff.userId }),
    ]);
  });
});
