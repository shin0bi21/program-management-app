/** Staff Hours pay-period rules. */
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PAY_PERIOD_DAYS = 14;

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

function dateOnlyToUtcMs(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function addCalendarDays(value: string, days: number) {
  return new Date(dateOnlyToUtcMs(value) + days * DAY_IN_MS).toISOString().slice(0, 10);
}
