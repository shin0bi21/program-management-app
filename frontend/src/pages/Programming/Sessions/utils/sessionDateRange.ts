import { Temporal } from 'temporal-polyfill';

const SESSION_TIME_ZONE = 'America/Toronto';

export function getSessionRequestRange(start: string, end: string) {
  const firstDay = Temporal.PlainDate.from(start);
  const exclusiveEnd = Temporal.PlainDate.from(end).add({ days: 1 });

  return {
    start: firstDay.toZonedDateTime(SESSION_TIME_ZONE).toInstant().toString(),
    end: exclusiveEnd.toZonedDateTime(SESSION_TIME_ZONE).toInstant().toString(),
  };
}
