import { Temporal } from 'temporal-polyfill';
import type { Program } from '../../../../common/features/programs/types';

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function nextSessionDate(program: Program, now = Temporal.Now.instant()) {
  const localNow = now.toZonedDateTimeISO(program.timezone);
  const weekday = weekdays.indexOf(program.defaultDayOfWeek) + 1;
  let days = (weekday - localNow.dayOfWeek + 7) % 7;
  if (days === 0 && Temporal.PlainTime.compare(localNow.toPlainTime(), program.defaultStartTime) >= 0) {
    days = 7;
  }

  return localNow.toPlainDate().add({ days }).toString();
}

export function sessionDateTime(value: string, timezone: string) {
  const local = Temporal.Instant.from(value).toZonedDateTimeISO(timezone);
  return { date: local.toPlainDate().toString(), time: local.toPlainTime().toString({ smallestUnit: 'minute' }) };
}

export function sessionInstant(date: string, time: string, timezone: string) {
  return Temporal.PlainDateTime.from(`${date}T${time}`)
    .toZonedDateTime(timezone, { disambiguation: 'reject' }).toInstant().toString();
}
