import { sql } from '../../../db/client';
import type { HoursCalendarQuery } from '../../../validation/hoursSchemas';
import {
  createHoursFixture, clearHoursRecords, deleteHoursFixture, emptyHoursFilters, type HoursFixture,
} from '../../../../tests/shared/hoursFixtures';
import { getHoursList } from './hoursListService';
import { getHoursCalendarData } from './hoursService';

describe('Hours collection queries', () => {
  let fixture: HoursFixture;
  beforeAll(async () => { fixture = await createHoursFixture(); });
  afterEach(async () => { await clearHoursRecords(fixture); });
  afterAll(async () => { await deleteHoursFixture(fixture); });

  it('searches the complete policy-scoped calendar collection', async () => {
    const { firstStaff, activeCycleId, programId, date } = fixture;
    const [entry] = await sql<Array<{ id: string }>>`INSERT INTO time_entries
      (staff_id, program_id, cycle_id, category, date, hours, note)
      VALUES (${firstStaff.userId}, ${programId}, ${activeCycleId}, 'meeting', ${date}, 1, 'Search marker') RETURNING id`;
    expect(await getHoursCalendarData(firstStaff.auth, { ...emptyHoursFilters, start: date, end: date, search: 'Search marker' }))
      .toEqual([expect.objectContaining({ id: entry.id, note: 'Search marker' })]);
    expect(await getHoursCalendarData(firstStaff.auth, { ...emptyHoursFilters, search: 'missing-entry' })).toEqual([]);
  });

  it('applies inclusive date bounds to calendar and paginated table reads', async () => {
    const { firstStaff, activeCycleId, programId, date, linkedDate, placementDate } = fixture;
    const ids: string[] = [];
    for (const workDate of [date, linkedDate, placementDate]) {
      const [entry] = await sql<Array<{ id: string }>>`INSERT INTO time_entries
        (staff_id, program_id, cycle_id, category, date, hours, note)
        VALUES (${firstStaff.userId}, ${programId}, ${activeCycleId}, 'meeting', ${workDate}, 1, 'Date range') RETURNING id`;
      ids.push(entry.id);
    }
    const query = { ...emptyHoursFilters, start: linkedDate, end: placementDate };
    const table = await getHoursList(firstStaff.auth, { ...query, sort: 'date', direction: 'asc' });
    const calendar = await getHoursCalendarData(firstStaff.auth, query);

    const expectedIds = ids.slice(1).sort();
    expect(table.rows.map(row => row.id).sort()).toEqual(expectedIds);
    expect(table.nextCursor).toBeNull();
    expect(calendar.map(row => row.id).sort()).toEqual(expectedIds);
  });

  it('filters selected cycles without widening readable staff scope', async () => {
    const { firstStaff, unrelatedStaff, activeCycleId, upcomingCycleId, programId, date, upcomingDate } = fixture;
    const ids: string[] = [];
    for (const [cycleId, workDate] of [[activeCycleId, date], [upcomingCycleId, upcomingDate]]) {
      const [entry] = await sql<Array<{ id: string }>>`INSERT INTO time_entries
        (staff_id, program_id, cycle_id, category, date, hours, note)
        VALUES (${firstStaff.userId}, ${programId}, ${cycleId}, 'meeting', ${workDate}, 1, 'Multiple cycles') RETURNING id`;
      ids.push(entry.id);
    }
    await sql`INSERT INTO time_entries (staff_id, cycle_id, category, date, hours, note)
      VALUES (${unrelatedStaff.userId}, ${activeCycleId}, 'meeting', ${date}, 1, 'Hidden cycle entry')`;
    const cases = [
      { cycleIds: [], expected: ids },
      { cycleIds: [activeCycleId], expected: [ids[0]] },
      { cycleIds: [activeCycleId, upcomingCycleId], expected: ids },
    ];
    for (const { cycleIds, expected } of cases) {
      const query = { ...emptyHoursFilters, cycleIds };
      const table = await getHoursList(firstStaff.auth, { ...query, sort: 'date', direction: 'asc' });
      const calendar = await getHoursCalendarData(firstStaff.auth, query);

      const expectedIds = [...expected].sort();
      expect(table.rows.map(row => row.id).sort()).toEqual(expectedIds);
      expect(calendar.map(row => row.id).sort()).toEqual(expectedIds);
    }
    const hidden = await getHoursList(firstStaff.auth, {
      ...emptyHoursFilters, staffIds: [unrelatedStaff.userId], cycleIds: [activeCycleId, upcomingCycleId], sort: 'date', direction: 'asc',
    });
    expect(hidden.rows).toEqual([]);
  });

  it('filters table and calendar records by category, program, source and staff', async () => {
    const { firstStaff, secondStaff, activeCycleId, programId, sessionId, date } = fixture;
    const [general, session, shared] = await sql<Array<{ id: string }>>`INSERT INTO time_entries
      (staff_id, program_id, cycle_id, session_id, category, date, hours, note) VALUES
      (${firstStaff.userId}, NULL, ${activeCycleId}, NULL, 'other', ${date}, 1, 'General'),
      (${firstStaff.userId}, ${programId}, ${activeCycleId}, ${sessionId}, 'program_delivery', ${date}, 1, 'Session'),
      (${secondStaff.userId}, ${programId}, ${activeCycleId}, NULL, 'meeting', ${date}, 1, 'Shared') RETURNING id`;

    const cases: Array<{ filters: Partial<HoursCalendarQuery>; expected: string[] }> = [
      { filters: { categories: ['meeting'] }, expected: [shared.id] },
      { filters: { programIds: ['general'] }, expected: [general.id] },
      { filters: { programIds: [programId] }, expected: [session.id, shared.id] },
      { filters: { types: ['session'] }, expected: [session.id] },
      { filters: { types: ['regular'] }, expected: [general.id, shared.id] },
      { filters: { staffIds: [secondStaff.userId] }, expected: [shared.id] },
    ];
    for (const { filters, expected } of cases) {
      const query = { ...emptyHoursFilters, ...filters };
      const table = await getHoursList(firstStaff.auth, { ...query, sort: 'date', direction: 'asc' });
      const calendar = await getHoursCalendarData(firstStaff.auth, query);

      const expectedIds = [...expected].sort();
      expect(table.rows.map(row => row.id).sort()).toEqual(expectedIds);
      expect(calendar.map(row => row.id).sort()).toEqual(expectedIds);
    }
  });

  it('reads own and shared staff across cycles when no date range is supplied', async () => {
    const { firstStaff, secondStaff, activeCycleId, upcomingCycleId, sessionId, programId, date, upcomingDate } = fixture;
    const entries = await sql<Array<{ id: string }>>`INSERT INTO time_entries
      (staff_id, program_id, cycle_id, session_id, category, date, hours, note) VALUES
      (${firstStaff.userId}, ${programId}, ${activeCycleId}, ${sessionId}, 'program_delivery', ${date}, 2, 'Delivered workshop'),
      (${secondStaff.userId}, ${programId}, ${upcomingCycleId}, NULL, 'outreach', ${upcomingDate}, 1, 'Campaign materials') RETURNING id`;
    const rows = await getHoursCalendarData(firstStaff.auth, emptyHoursFilters);
    expect(rows.map(row => row.id).sort()).toEqual(entries.map(entry => entry.id).sort());
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ staffId: firstStaff.userId, date, cycleId: activeCycleId, note: 'Delivered workshop' }),
      expect.objectContaining({ staffId: secondStaff.userId, date: upcomingDate, cycleId: upcomingCycleId, note: 'Campaign materials' }),
    ]));
  });
});
