import { sql } from '../../../db/client';
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

  it('applies inclusive date bounds before table pagination and matches calendar membership', async () => {
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
    expect(table.rows.map(row => row.id).sort()).toEqual(ids.slice(1).sort());
    expect(table.nextCursor).toBeNull();
    expect((await getHoursCalendarData(firstStaff.auth, query)).map(row => row.id).sort()).toEqual(ids.slice(1).sort());
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
      expect(table.rows.map(row => row.id).sort()).toEqual([...expected].sort());
      expect((await getHoursCalendarData(firstStaff.auth, query)).map(row => row.id).sort()).toEqual([...expected].sort());
    }
    const hidden = await getHoursList(firstStaff.auth, {
      ...emptyHoursFilters, staffIds: [unrelatedStaff.userId], cycleIds: [activeCycleId, upcomingCycleId], sort: 'date', direction: 'asc',
    });
    expect(hidden.rows).toEqual([]);
  });

  it('applies identical domain filters to table and calendar reads', async () => {
    const { firstStaff, unrelatedStaff, activeCycleId, programId, date } = fixture;
    const [general] = await sql<Array<{ id: string }>>`INSERT INTO time_entries
      (staff_id, cycle_id, category, date, hours, note)
      VALUES (${firstStaff.userId}, ${activeCycleId}, 'other', ${date}, 1, 'General filtered entry') RETURNING id`;
    await sql`INSERT INTO time_entries (staff_id, program_id, cycle_id, category, date, hours, note) VALUES
      (${firstStaff.userId}, ${programId}, ${activeCycleId}, 'meeting', ${date}, 1, 'Program entry'),
      (${unrelatedStaff.userId}, ${programId}, ${activeCycleId}, 'other', ${date}, 1, 'Hidden entry')`;
    const filters = [
      { ...emptyHoursFilters, categories: ['other'] as ['other'] },
      { ...emptyHoursFilters, programIds: ['general'] },
      { ...emptyHoursFilters, types: ['regular'] as ['regular'] },
      { ...emptyHoursFilters, staffIds: [firstStaff.userId] },
      { ...emptyHoursFilters, cycleIds: [activeCycleId] },
    ];
    for (const query of filters) {
      const table = await getHoursList(firstStaff.auth, { ...query, start: date, end: date, sort: 'date', direction: 'asc' });
      const calendar = await getHoursCalendarData(firstStaff.auth, { ...query, start: date, end: date });
      expect(calendar.map(row => row.id).sort()).toEqual(table.rows.map(row => row.id).sort());
      expect(calendar.some(row => row.staffId === unrelatedStaff.userId)).toBe(false);
    }
    const generalTable = await getHoursList(firstStaff.auth, {
      ...emptyHoursFilters, programIds: ['general'], types: ['regular'], sort: 'date', direction: 'asc',
    });
    expect(generalTable.rows.map(row => row.id)).toEqual([general.id]);
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

  it('accepts supported calendar ranges spanning more than one year', async () => {
    expect(await getHoursCalendarData(fixture.firstStaff.auth, { ...emptyHoursFilters, start: '2025-01-01', end: '2026-01-02' }))
      .toEqual([]);
  });
});
