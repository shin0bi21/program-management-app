const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PAY_PERIOD_DAYS = 14;

/**
 * Finds the pay period containing a date, anchored to the cycle start.
 * @param cycleStartsOn - Validated cycle start in YYYY-MM-DD format.
 * @param currentDate - Validated date in YYYY-MM-DD format.
 * @example getBiweeklyPayPeriod('2026-02-01', '2026-02-15') // February 15–28
 */
export function getBiweeklyPayPeriod(cycleStartsOn: string, currentDate: string) {
  const elapsedDays = Math.floor(
    (dateOnlyToUtcMs(currentDate) - dateOnlyToUtcMs(cycleStartsOn)) / DAY_IN_MS,
  );
  const periodOffset = Math.floor(elapsedDays / PAY_PERIOD_DAYS) * PAY_PERIOD_DAYS;
  const periodStart = addCalendarDays(cycleStartsOn, periodOffset);
  return {
    periodStart,
    periodEnd: addCalendarDays(periodStart, PAY_PERIOD_DAYS - 1),
  };
}

/**
 * Converts a calendar date to UTC midnight for date arithmetic.
 * @param value - Validated date in YYYY-MM-DD format.
 * @example dateOnlyToUtcMs('1970-01-01') // 0
 */
function dateOnlyToUtcMs(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

/**
 * Shifts a calendar date by a whole number of days.
 * @param value - Validated date in YYYY-MM-DD format.
 * @param days - Signed whole-day offset.
 * @example addCalendarDays('2026-02-01', 14) // '2026-02-15'
 */
function addCalendarDays(value: string, days: number) {
  return new Date(dateOnlyToUtcMs(value) + days * DAY_IN_MS).toISOString().slice(0, 10);
}
