import { z } from 'zod';
import { hoursCalendarQuerySchema, hoursTableQuerySchema } from './hoursSchemas';
import { taskCalendarQuerySchema, taskListQuerySchema } from './taskSchemas';
import { sessionListQuerySchema } from './programmingSchemas';
import { calendarDateSchema, hasOrderedCalendarBounds, hasPairedCalendarBounds } from './dateRangeValidation';

const rangeSchema = z.object({
  start: calendarDateSchema().optional(),
  end: calendarDateSchema().optional(),
}).refine(hasPairedCalendarBounds).refine(hasOrderedCalendarBounds);

describe('Calendar date ranges', () => {
  it.each([
    [{}, true],
    [{ start: '2026-01-01' }, false],
    [{ end: '2026-01-01' }, false],
    [{ start: '2026-01-01', end: '2026-01-01' }, true],
    [{ start: '2025-01-01', end: '2027-01-01' }, true],
    [{ start: '2026-01-02', end: '2026-01-01' }, false],
    [{ start: '2026-02-30', end: '2026-03-01' }, false],
    [{ start: '0000-01-01', end: '0000-01-02' }, false],
  ])('validates %o', (range, expected) => {
    expect(rangeSchema.safeParse(range).success).toBe(expected);
  });
});

describe('Calendar query range contracts', () => {
  it.each([hoursCalendarQuerySchema, hoursTableQuerySchema, taskListQuerySchema, sessionListQuerySchema])(
    'accepts omitted and multi-year bounds and rejects incomplete or reversed bounds',
    schema => {
      expect(schema.safeParse({ query: {} }).success).toBe(true);
      expect(schema.safeParse({ query: { start: '2025-01-01', end: '2027-01-01' } }).success).toBe(true);
      expect(schema.safeParse({ query: { start: '2026-01-01' } }).success).toBe(false);
      expect(schema.safeParse({ query: { start: '2026-02-01', end: '2026-01-01' } }).success).toBe(false);
    },
  );

  it('requires both bounds for the task calendar', () => {
    expect(taskCalendarQuerySchema.safeParse({ query: {} }).success).toBe(false);
    expect(taskCalendarQuerySchema.safeParse({ query: { start: '2025-01-01', end: '2027-01-01' } }).success).toBe(true);
  });
});
