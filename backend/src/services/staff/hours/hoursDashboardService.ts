import { sql } from '../../../db/client';
import { InternalServerError, NotFoundError } from '../../../errors';
import type { AccessTokenPayload } from '../../../types/auth';
import type { HoursCategory, HoursCycleSummaryQuery, HoursPayPeriodQuery } from '../../../validation/hoursSchemas';
import { getStaffReferenceData } from '../../referenceData/staffReferenceData';
import { getHoursCategoryLabel } from './hoursReferenceData';
import { getBiweeklyPayPeriod } from './payPeriodUtils';

interface HoursCategoryTotal {
  category: HoursCategory;
  hours: number;
}

/**
 * Summarizes accessible staff hours for the pay period containing the requested date.
 * @param actor - Actor whose staff access is enforced.
 * @param query - Staff member and optional date; omission uses today's Toronto date.
 * @example getHoursPayPeriodData(actor, { staffId }) // current pay-period total and breakdown
 */
export async function getHoursPayPeriodData(actor: AccessTokenPayload, query: HoursPayPeriodQuery) {
  // 1. Check access to the staff member.
  await assertReadableStaff(actor, query.staffId);

  // 2. Find the pay period independently of the dashboard's selected cycle.
  const [payPeriodCycle] = await sql<Array<{ startsOn: string; requestedDate: string }>>`
    SELECT
      starts_on::text AS starts_on,
      COALESCE(${query.date ?? null}::date, (NOW() AT TIME ZONE 'America/Toronto')::date)::text AS requested_date
    FROM program_cycles
    WHERE starts_on <= COALESCE(${query.date ?? null}::date, (NOW() AT TIME ZONE 'America/Toronto')::date)
    ORDER BY starts_on DESC, id
    LIMIT 1
  `;
  if (!payPeriodCycle) {
    if (query.date) throw new NotFoundError('Hours pay period not found');

    throw new InternalServerError('Expected a program cycle to have started before the requested pay period.');
  }
  const payPeriod = getBiweeklyPayPeriod(payPeriodCycle.startsOn, payPeriodCycle.requestedDate);

  // 3. Summarize every entry within the pay period, regardless of cycle membership.
  const rows = await sql<HoursCategoryTotal[]>`
    SELECT
      category,
      SUM(hours)::double precision AS hours
    FROM time_entries
    WHERE staff_id = ${query.staffId}
      AND date BETWEEN ${payPeriod.periodStart}::date AND ${payPeriod.periodEnd}::date
    GROUP BY category
  `;
  const breakdown = buildBreakdown(rows);
  return {
    ...payPeriod,
    totalHours: breakdown.reduce((total, item) => total + item.hours, 0),
    breakdown,
  };
}

/**
 * Summarizes accessible staff hours as a biweekly average for one cycle.
 * @param actor - Actor whose staff access is enforced.
 * @param query - Staff member and cycle whose entries contribute to the average.
 * @example getHoursCycleSummaryData(actor, { staffId, cycleId }) // cycle average and breakdown
 */
export async function getHoursCycleSummaryData(actor: AccessTokenPayload, query: HoursCycleSummaryQuery) {
  // 1. Check access to the staff member before exposing cycle data.
  await assertReadableStaff(actor, query.staffId);

  // 2. Count elapsed pay periods, capped at the cycle's inclusive end date.
  const [cycle] = await sql<Array<{ periodCount: number }>>`
    SELECT ((GREATEST(
      starts_on,
      LEAST(ends_on, (NOW() AT TIME ZONE 'America/Toronto')::date)
    ) - starts_on) / 14) + 1 AS period_count
    FROM program_cycles
    WHERE id = ${query.cycleId}
  `;
  if (!cycle) throw new NotFoundError('Hours cycle summary not found');

  // 3. Average the cycle's category totals over its elapsed periods.
  const rows = await sql<HoursCategoryTotal[]>`
    SELECT
      category,
      SUM(hours)::double precision AS hours
    FROM time_entries
    WHERE staff_id = ${query.staffId}
      AND cycle_id = ${query.cycleId}
    GROUP BY category
  `;
  const breakdown = buildBreakdown(rows, cycle.periodCount);
  return {
    periodCount: cycle.periodCount,
    averageHours: breakdown.reduce((total, item) => total + item.hours, 0),
    breakdown,
  };
}

/**
 * Conceals summaries for staff resources outside the actor's Hours visibility.
 * @param actor - Actor whose readable staff resources determine access.
 * @param staffId - Requested staff resource ID.
 * @example await assertReadableStaff(actor, staffId) // throws 404 for an unrelated resource
 */
async function assertReadableStaff(actor: AccessTokenPayload, staffId: string) {
  const readableStaff = await getStaffReferenceData(actor, 'hours');
  if (!readableStaff.some(resource => resource.id === staffId)) {
    throw new NotFoundError('Hours overview not found');
  }
}

/**
 * Labels positive category totals and orders the largest contribution first.
 * @param rows - Database category totals in hours.
 * @param periodCount - Positive elapsed-period count; omit for unaveraged totals.
 * @example buildBreakdown([{ category: 'meeting', hours: 4 }], 2) // [{ label: 'Meeting', hours: 2 }]
 */
function buildBreakdown(rows: HoursCategoryTotal[], periodCount = 1) {
  return rows
    .filter(row => row.hours > 0)
    .map(row => ({ label: getHoursCategoryLabel(row.category), hours: row.hours / periodCount }))
    .sort((left, right) => right.hours - left.hours || left.label.localeCompare(right.label));
}
