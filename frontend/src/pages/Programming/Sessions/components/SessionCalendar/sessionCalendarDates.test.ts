// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { makeProgramSession } from '../../../../../tests/factories/session';
import { getSessionRange } from './sessionCalendarDates';
import { getSessionRequestRange } from '../../utils/sessionDateRange';

describe('session calendar date boundaries', () => {
  it.each([
    ['2026-03-08', '2026-03-08T05:00:00Z', '2026-03-09T04:00:00Z'],
    ['2026-11-01', '2026-11-01T04:00:00Z', '2026-11-02T05:00:00Z'],
    ['2028-02-29', '2028-02-29T05:00:00Z', '2028-03-01T05:00:00Z'],
    ['2026-12-31', '2026-12-31T05:00:00Z', '2027-01-01T05:00:00Z'],
  ])('queries the complete Toronto day %s with an exclusive timestamp end', (day, start, end) => {
    expect(getSessionRequestRange(day, day)).toEqual({ start, end });
  });

  it.each([
    ['2026-08-10T02:00:00Z', '2026-08-10T04:00:00Z', '2026-08-09', '2026-08-09'],
    ['2026-08-10T02:00:00Z', '2026-08-10T04:00:00.001Z', '2026-08-09', '2026-08-10'],
    ['2026-03-08T04:30:00Z', '2026-03-09T04:00:00Z', '2026-03-07', '2026-03-08'],
    ['2026-11-01T03:30:00Z', '2026-11-02T05:00:00Z', '2026-10-31', '2026-11-01'],
  ])('places the full session %s to %s on inclusive Toronto days', (startsAt, endsAt, start, end) => {
    expect(getSessionRange(makeProgramSession({ startsAt, endsAt }))).toEqual({ start, end });
  });
});
