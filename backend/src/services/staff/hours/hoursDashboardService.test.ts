import { sql } from '../../../db/client';
import { NotFoundError } from '../../../errors';
import {
  createHoursFixture, clearHoursRecords, deleteHoursFixture, type HoursFixture,
} from '../../../../tests/shared/hoursFixtures';
import { getHoursCycleSummaryData, getHoursPayPeriodData } from './hoursDashboardService';

describe('Hours dashboard service', () => {
  let fixture: HoursFixture;
  beforeAll(async () => { fixture = await createHoursFixture(); });
  afterEach(async () => { await clearHoursRecords(fixture); });
  afterAll(async () => { await deleteHoursFixture(fixture); });

  it('keeps pay-period totals independent of cycle averages', async () => {
    const { firstStaff, admin, activeCycleId, upcomingCycleId, date } = fixture;
    const [period] = await sql<Array<{ periodStart: string; periodEnd: string }>>`
      SELECT starts_on AS period_start, starts_on + 13 AS period_end FROM program_cycles WHERE id = ${activeCycleId}
    `;
    await sql`INSERT INTO time_entries (staff_id, cycle_id, category, date, hours, note) VALUES
      (${firstStaff.userId}, ${activeCycleId}, 'meeting', ${period.periodStart}, 2, 'Current meeting'),
      (${firstStaff.userId}, ${activeCycleId}, 'outreach', ${date}, 3, 'Current outreach'),
      (${firstStaff.userId}, ${upcomingCycleId}, 'meeting', ${date}, 1, 'Other cycle in period')`;

    expect(await getHoursPayPeriodData(admin.auth, { staffId: firstStaff.userId })).toEqual({
      ...period, totalHours: 6, breakdown: [{ label: 'Meeting', hours: 3 }, { label: 'Outreach', hours: 3 }],
    });
    expect(await getHoursCycleSummaryData(admin.auth, { staffId: firstStaff.userId, cycleId: activeCycleId })).toEqual({
      periodCount: 1, averageHours: 5, breakdown: [{ label: 'Outreach', hours: 3 }, { label: 'Meeting', hours: 2 }],
    });
  });

  it('loads a requested pay period without a selected cycle', async () => {
    const { firstStaff, activeCycleId, upcomingDate } = fixture;
    const [current] = await sql<Array<{ periodStart: string; periodEnd: string }>>`
      SELECT starts_on AS period_start, starts_on + 13 AS period_end FROM program_cycles WHERE id = ${activeCycleId}
    `;
    const [requested] = await sql<Array<{ periodStart: string; periodEnd: string }>>`
      SELECT ${upcomingDate}::date AS period_start, ${upcomingDate}::date + 13 AS period_end
    `;
    expect(await getHoursPayPeriodData(firstStaff.auth, { staffId: firstStaff.userId })).toEqual(expect.objectContaining(current));
    expect(await getHoursPayPeriodData(firstStaff.auth, { staffId: firstStaff.userId, date: upcomingDate }))
      .toEqual(expect.objectContaining(requested));
  });

  it('keeps pay-period data available when cycles overlap', async () => {
    const { firstStaff, activeCycleId } = fixture;
    const [overlap] = await sql<Array<{ id: string }>>`
      INSERT INTO program_cycles (title, starts_on, ends_on)
      SELECT 'Overlapping Hours', starts_on, ends_on FROM program_cycles WHERE id = ${activeCycleId} RETURNING id
    `;
    try {
      expect(await getHoursPayPeriodData(firstStaff.auth, { staffId: firstStaff.userId }))
        .toEqual(expect.objectContaining({ totalHours: 0 }));
    } finally {
      await sql`DELETE FROM program_cycles WHERE id = ${overlap.id}`;
    }
  });

  it('reads shared staff summaries without matching entry metadata', async () => {
    const { secondStaff, firstStaff, activeCycleId, date } = fixture;
    await sql`INSERT INTO time_entries (staff_id, cycle_id, category, date, hours, note)
      VALUES (${secondStaff.userId}, ${activeCycleId}, 'meeting', ${date}, 2, 'Shared overview')`;
    expect(await getHoursPayPeriodData(firstStaff.auth, { staffId: secondStaff.userId }))
      .toEqual(expect.objectContaining({ totalHours: 2, breakdown: [{ label: 'Meeting', hours: 2 }] }));
    expect(await getHoursCycleSummaryData(firstStaff.auth, { staffId: secondStaff.userId, cycleId: activeCycleId }))
      .toEqual(expect.objectContaining({ averageHours: 2 }));
  });

  it('returns empty summaries and conceals missing cycles or unavailable pay periods', async () => {
    const { firstStaff, activeCycleId } = fixture;
    expect(await getHoursPayPeriodData(firstStaff.auth, { staffId: firstStaff.userId }))
      .toEqual(expect.objectContaining({ totalHours: 0, breakdown: [] }));
    expect(await getHoursCycleSummaryData(firstStaff.auth, { staffId: firstStaff.userId, cycleId: activeCycleId }))
      .toEqual({ periodCount: 1, averageHours: 0, breakdown: [] });
    await expect(getHoursCycleSummaryData(firstStaff.auth, {
      staffId: firstStaff.userId, cycleId: '00000000-0000-4000-8000-000000000000',
    })).rejects.toBeInstanceOf(NotFoundError);
    await expect(getHoursPayPeriodData(firstStaff.auth, { staffId: firstStaff.userId, date: '0001-01-01' }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('conceals both summaries for an unreadable staff member', async () => {
    const { firstStaff, unrelatedStaff, activeCycleId } = fixture;
    await expect(getHoursPayPeriodData(firstStaff.auth, { staffId: unrelatedStaff.userId })).rejects.toBeInstanceOf(NotFoundError);
    await expect(getHoursCycleSummaryData(firstStaff.auth, { staffId: unrelatedStaff.userId, cycleId: activeCycleId }))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});
