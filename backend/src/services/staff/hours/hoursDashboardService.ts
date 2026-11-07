import { sql } from '../../../db/client';
import { InternalServerError, NotFoundError } from '../../../errors';
import type { AccessTokenPayload } from '../../../types/auth';
import type { HoursCategory, HoursDashboardQuery } from '../../../validation/hoursSchemas';
import { getStaffReferenceData } from '../../referenceData/staffReferenceData';
import { getHoursCategoryLabel } from './hoursReferenceData';
import { getBiweeklyPayPeriod } from './payPeriodUtils';

/**
 * Summarizes accessible staff hours for a pay period and cycle.
 * @param actor - Actor whose staff access is enforced.
 * @param query - Staff member and selected cycle.
 * @example getHoursDashboardData(actor, query) // totals and category breakdowns
 */
export async function getHoursDashboardData(actor: AccessTokenPayload, query: HoursDashboardQuery) {
  // 1. Check access to the staff member.
  const readableStaff = await getStaffReferenceData(actor, 'hours');
  if (!readableStaff.some(resource => resource.id === query.staffId)) {
    throw new NotFoundError('Hours overview not found');
  }

  // 2. Find the current pay period.
  const [payPeriodCycle] = await sql<Array<{ startsOn: string; currentDate: string }>>`
    SELECT starts_on::text AS starts_on,
      (NOW() AT TIME ZONE 'America/Toronto')::date::text AS current_date
    FROM program_cycles
    WHERE starts_on <= (NOW() AT TIME ZONE 'America/Toronto')::date
    ORDER BY starts_on DESC, id
    LIMIT 1
  `;
  if (!payPeriodCycle) {
    throw new InternalServerError('Expected a program cycle to have started before the current pay period.');
  }
  const payPeriod = getBiweeklyPayPeriod(payPeriodCycle.startsOn, payPeriodCycle.currentDate);

  // 3. Load the hours totals.
  const rows = await sql<Array<{
    periodStart: string;
    periodEnd: string;
    periodCount: number;
    category: HoursCategory | null;
    periodHours: string;
    cycleHours: string;
  }>>`
    WITH current_period AS (
      SELECT
        ${payPeriod.periodStart}::date AS period_start,
        ${payPeriod.periodEnd}::date AS period_end
    ), selected_cycle AS (
      SELECT id, starts_on, ends_on,
        GREATEST(
          starts_on,
          LEAST(ends_on, (NOW() AT TIME ZONE 'America/Toronto')::date)
        ) AS effective_date
      FROM program_cycles
      WHERE id = ${query.cycleId}
    ), selected_cycle_summary AS (
      SELECT id,
        ((effective_date - starts_on) / 14) + 1 AS period_count
      FROM selected_cycle
    ), categories AS (
      SELECT DISTINCT entry.category
      FROM time_entries entry, current_period period
      WHERE entry.staff_id = ${query.staffId}
        AND (
          entry.date BETWEEN period.period_start AND period.period_end
          OR entry.cycle_id = (
            SELECT id
            FROM selected_cycle
          )
        )
    )
    SELECT
      period.period_start::text AS period_start,
      period.period_end::text AS period_end,
      selected.period_count,
      category.category,
      COALESCE((
        SELECT SUM(entry.hours)
        FROM time_entries entry
        WHERE entry.staff_id = ${query.staffId}
          AND entry.category = category.category
          AND entry.date BETWEEN period.period_start AND period.period_end
      ), 0)::text AS period_hours,
      COALESCE((
        SELECT SUM(entry.hours)
        FROM time_entries entry
        WHERE entry.staff_id = ${query.staffId}
          AND entry.cycle_id = selected.id
          AND entry.category = category.category
      ), 0)::text AS cycle_hours
    FROM current_period period
    CROSS JOIN selected_cycle_summary selected
    LEFT JOIN categories category ON TRUE
    ORDER BY category.category
  `;
  if (!rows.length) throw new NotFoundError('Hours overview not found');

  // 4. Build the category breakdowns.
  const payPeriodBreakdown = rows.flatMap(row => row.category && Number(row.periodHours) > 0
    ? [{ label: getHoursCategoryLabel(row.category), hours: Number(row.periodHours) }]
    : []).sort((left, right) => right.hours - left.hours || left.label.localeCompare(right.label));
  const periodCount = Number(rows[0].periodCount);
  const biweeklyBreakdown = rows.flatMap(row => row.category && Number(row.cycleHours) > 0
    ? [{ label: getHoursCategoryLabel(row.category), hours: Number(row.cycleHours) / periodCount }]
    : []).sort((left, right) => right.hours - left.hours || left.label.localeCompare(right.label));
  return {
    payPeriod: {
      periodStart: rows[0].periodStart,
      periodEnd: rows[0].periodEnd,
      totalHours: payPeriodBreakdown.reduce((total, item) => total + item.hours, 0),
      breakdown: payPeriodBreakdown,
    },
    biweeklyAverage: {
      periodCount,
      averageHours: biweeklyBreakdown.reduce((total, item) => total + item.hours, 0),
      breakdown: biweeklyBreakdown,
    },
  };
}
