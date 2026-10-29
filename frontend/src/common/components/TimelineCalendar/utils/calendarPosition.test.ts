import { afterEach, describe, expect, it } from 'vitest';

import { loadCalendarPosition } from './calendarPosition';

describe('loadCalendarPosition', () => {
  afterEach(() => localStorage.clear());

  it.each([
    ['malformed JSON', '{'],
    ['invalid date', JSON.stringify({ date: '2026-02-30', offset: 12 })],
    ['negative offset', JSON.stringify({ date: '2026-02-28', offset: -1 })],
  ])('removes %s and falls back to the supplied date', (_case, stored) => {
    const fallbackDate = new Date(2026, 5, 10);
    localStorage.setItem('calendar-position', stored);

    expect(loadCalendarPosition('calendar-position', fallbackDate)).toEqual({ date: fallbackDate, offset: 0 });
    expect(localStorage.getItem('calendar-position')).toBeNull();
  });

  it('restores a valid saved date and offset without removing it', () => {
    const stored = JSON.stringify({ date: '2026-02-28', offset: 24 });
    localStorage.setItem('calendar-position', stored);

    expect(loadCalendarPosition('calendar-position', new Date(2026, 5, 10))).toEqual({
      date: new Date(2026, 1, 28),
      offset: 24,
    });
    expect(localStorage.getItem('calendar-position')).toBe(stored);
  });
});
