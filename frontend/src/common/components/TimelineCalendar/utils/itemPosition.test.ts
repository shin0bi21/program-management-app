// @vitest-environment node
// This suite owns inclusive range clipping, overlap lanes, and density positioning.
import { describe, expect, it } from 'vitest';
import { addDays, buildDayPeriod } from './periods';
import { positionItems } from './itemPosition';

const periods = Array.from(
  { length: 5 },
  (_, index) => buildDayPeriod(addDays('2026-08-09', index)),
);

describe('positionItems', () => {
  it('positions overlapping items in separate lanes', () => {
    const items = [
      { id: 'a', start: '2026-08-09', end: '2026-08-11' },
      { id: 'b', start: '2026-08-10', end: '2026-08-12' },
    ];
    const positioned = positionItems(items, periods, item => ({ start: item.start, end: item.end }));
    expect(positioned.map(item => ({ id: item.item.id, lane: item.lane, laneCount: item.laneCount }))).toEqual([
      { id: 'a', lane: 0, laneCount: 2 },
      { id: 'b', lane: 1, laneCount: 2 },
    ]);
  });

  it('places the longer item in the upper lane when items start together', () => {
    const items = [
      { id: 'short', start: '2026-08-10', end: '2026-08-11' },
      { id: 'long', start: '2026-08-10', end: '2026-08-13' },
    ];
    const positioned = positionItems(items, periods, item => ({ start: item.start, end: item.end }));

    expect(positioned.map(item => ({ id: item.item.id, lane: item.lane }))).toEqual([
      { id: 'long', lane: 0 },
      { id: 'short', lane: 1 },
    ]);
  });

  it('uses the same positioning for one-period items', () => {
    const positioned = positionItems([
      { id: 'a', date: '2026-08-10' },
      { id: 'b', date: '2026-08-10' },
    ], periods, item => ({ start: item.date, end: item.date }));
    expect(positioned.map(item => ({ id: item.item.id, start: item.startIndex, end: item.endIndex, lane: item.lane }))).toEqual([
      { id: 'a', start: 1, end: 1, lane: 0 },
      { id: 'b', start: 1, end: 1, lane: 1 },
    ]);
  });

  it('clips items to the visible period window', () => {
    const positioned = positionItems([
      { id: 'a', start: '2026-01-01', end: '2026-08-10' },
      { id: 'b', start: '2026-08-12', end: '2026-12-31' },
    ], periods, item => ({ start: item.start, end: item.end }));
    expect(positioned.map(item => ({ id: item.item.id, start: item.startIndex, end: item.endIndex }))).toEqual([
      { id: 'a', start: 0, end: 1 },
      { id: 'b', start: 3, end: 4 },
    ]);
  });
});
