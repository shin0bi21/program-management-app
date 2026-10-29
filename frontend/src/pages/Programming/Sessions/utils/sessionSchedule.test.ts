// @vitest-environment node
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import type { Program } from '../../../../common/features/programs/types';
import { nextSessionDate, sessionDateTime, sessionInstant } from './sessionSchedule';

const program: Program = {
  id: 'program-1', name: 'Art', enrollmentRequired: false, minAge: null, maxAge: null,
  defaultDayOfWeek: 'tuesday', defaultStartTime: '17:30', defaultEndTime: '19:30', timezone: 'America/Toronto',
};

describe('program session scheduling', () => {
  it.each([
    ['2026-10-26T23:00:00Z', '2026-10-27'],
    ['2026-10-27T21:29:59Z', '2026-10-27'],
    ['2026-10-27T21:30:00Z', '2026-11-03'],
    ['2026-10-28T01:00:00Z', '2026-11-03'],
  ])('chooses the next available default weekday at %s', (now, date) => {
    expect(nextSessionDate(program, Temporal.Instant.from(now))).toBe(date);
  });

  it('keeps local session hours consistent across daylight saving changes', () => {
    expect(sessionInstant('2026-10-27', '17:30', program.timezone)).toBe('2026-10-27T21:30:00Z');
    expect(sessionInstant('2026-11-03', '17:30', program.timezone)).toBe('2026-11-03T22:30:00Z');
    expect(sessionDateTime('2026-11-03T22:30:00Z', program.timezone)).toEqual({ date: '2026-11-03', time: '17:30' });
  });

  it('rejects nonexistent or ambiguous local editing times', () => {
    expect(() => sessionInstant('2026-03-08', '02:30', program.timezone)).toThrow();
    expect(() => sessionInstant('2026-11-01', '01:30', program.timezone)).toThrow();
  });
});
