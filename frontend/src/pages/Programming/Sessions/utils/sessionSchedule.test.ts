// @vitest-environment node
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import type { Program } from '../../../../common/features/programs/types';
import { nextSessionDate } from './sessionSchedule';

const program: Program = {
  id: 'program-1', title: 'Art', enrollmentRequired: false, minAge: null, maxAge: null,
  defaultDayOfWeek: 'tuesday', defaultStartTime: '17:30', defaultEndTime: '19:30', timezone: 'America/Toronto',
};

describe('program session scheduling', () => {
  it.each([
    ['2026-10-26T19:00', '2026-10-27'],
    ['2026-10-27T17:29:59', '2026-10-27'],
    ['2026-10-27T17:30', '2026-11-03'],
    ['2026-10-27T21:00', '2026-11-03'],
  ])('chooses the next available default weekday at %s', (now, date) => {
    expect(nextSessionDate(program, Temporal.PlainDateTime.from(now))).toBe(date);
  });

});
