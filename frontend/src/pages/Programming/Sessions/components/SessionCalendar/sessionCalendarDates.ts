import { Temporal } from 'temporal-polyfill';
import { getDateKeyInTimeZone } from '../../../../../common/utils/date';
import type { CohortSession } from '../../types';

const SESSION_TIME_ZONE = 'America/Toronto';

export function getSessionRequestRange(start: string, end: string) {
  const firstDay = Temporal.PlainDate.from(start);
  const exclusiveEnd = Temporal.PlainDate.from(end).add({ days: 1 });

  return {
    start: firstDay.toZonedDateTime(SESSION_TIME_ZONE).toInstant().toString(),
    end: exclusiveEnd.toZonedDateTime(SESSION_TIME_ZONE).toInstant().toString(),
  };
}

export function getSessionRange(session: CohortSession) {
  // Session timestamps have an exclusive end; midnight belongs to the preceding calendar day.
  const lastIncludedInstant = new Date(new Date(session.endsAt).getTime() - 1);

  return {
    start: getDateKeyInTimeZone(new Date(session.startsAt), SESSION_TIME_ZONE),
    end: getDateKeyInTimeZone(lastIncludedInstant, SESSION_TIME_ZONE),
  };
}
