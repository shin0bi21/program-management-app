import { getDateKeyInTimeZone } from '../../../../../common/utils/date';
import type { ProgramSession } from '../../types';

const SESSION_TIME_ZONE = 'America/Toronto';

/**
 * Maps a session's occupied days to inclusive America/Toronto dates, respecting daylight saving time.
 * @param session - Valid ISO timestamps with explicit UTC offsets (or Z), at millisecond precision;
 * startsAt must precede the exclusive endsAt. Callers validate these preconditions.
 * @returns Inclusive start/end keys in YYYY-MM-DD format, independent of the browser's locale or timezone.
 * @example
 * getSessionRange({ ...session, startsAt: '2026-08-10T02:00:00Z', endsAt: '2026-08-10T04:00:00Z' })
 * // { start: '2026-08-09', end: '2026-08-09' }: 10 p.m. to midnight in Toronto.
 */
export function getSessionRange(session: ProgramSession) {
  // Session timestamps have an exclusive end; midnight belongs to the preceding calendar day.
  const lastIncludedInstant = new Date(new Date(session.endsAt).getTime() - 1);

  return {
    start: getDateKeyInTimeZone(new Date(session.startsAt), SESSION_TIME_ZONE),
    end: getDateKeyInTimeZone(lastIncludedInstant, SESSION_TIME_ZONE),
  };
}
