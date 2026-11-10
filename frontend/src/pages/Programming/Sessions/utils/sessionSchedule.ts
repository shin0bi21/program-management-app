import { Temporal } from 'temporal-polyfill';
import type { Program } from '../../../../common/features/programs/types';

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Chooses the next default weekday whose start time has not passed.
 * @param program - Saved weekday, clock time, and Eastern scheduling context.
 * @param now - Current instant, overridable for deterministic scheduling.
 * @example With Tuesday defaults at 17:30, Tuesday at 18:00 returns the following Tuesday.
 */
export function nextSessionDate(program: Program, now = Temporal.Now.instant()) {
  const localNow = now.toZonedDateTimeISO(program.timezone);
  const weekday = weekdays.indexOf(program.defaultDayOfWeek) + 1;
  let days = (weekday - localNow.dayOfWeek + 7) % 7;
  if (days === 0 && Temporal.PlainTime.compare(localNow.toPlainTime(), program.defaultStartTime) >= 0) {
    days = 7;
  }

  return localNow.toPlainDate().add({ days }).toString();
}

/**
 * Formats a saved clock time without timezone conversion.
 * @param value - Session clock time using HH:mm.
 * @example formatSessionTime('17:30') // '5:30 p.m.' (locale spacing may vary)
 */
export function formatSessionTime(value: string) {
  return Temporal.PlainTime.from(value).toLocaleString('en-CA', { hour: 'numeric', minute: '2-digit' });
}
