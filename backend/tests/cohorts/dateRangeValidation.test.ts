import { sessionListQuerySchema } from '../../src/validation/cohortSchemas';
import { hoursCalendarQuerySchema, hoursTableQuerySchema } from '../../src/validation/hoursSchemas';
import { setTaskSchema, taskCalendarQuerySchema, taskListQuerySchema } from '../../src/validation/taskSchemas';

const dateQuerySchemas = [
  ['Tasks table', taskListQuerySchema],
  ['Tasks calendar', taskCalendarQuerySchema],
  ['Hours table', hoursTableQuerySchema],
  ['Hours calendar', hoursCalendarQuerySchema],
] as const;

describe.each(dateQuerySchemas)('%s page date ranges', (_name, schema) => {
  it('accepts 366 inclusive dates in a leap year and rejects the 367th date', () => {
    expect(schema.safeParse({ query: { start: '2024-01-01', end: '2024-12-31' } }).success).toBe(true);
    expect(schema.safeParse({ query: { start: '2024-01-01', end: '2025-01-01' } }).success).toBe(false);
  });

  it.each(['0001-01-01', '0099-12-31', '0100-02-28', '2000-02-29', '9999-12-31'])(
    'accepts supported real calendar date %s', date => {
      expect(schema.safeParse({ query: { start: date, end: date } }).success).toBe(true);
    },
  );

  it.each(['0000-01-01', '0099-02-29', '0100-02-29', '2026-02-30'])(
    'rejects unsupported or nonexistent calendar date %s', date => {
      expect(schema.safeParse({ query: { start: date, end: date } }).success).toBe(false);
    },
  );
});

describe('Session timestamp page date ranges', () => {
  it.each([
    ['2024-01-01T00:00:00-05:00', '2025-01-01T00:00:00-05:00'],
    ['2024-11-02T00:00:00-04:00', '2025-11-03T00:00:00-05:00'],
  ])('accepts 366 Toronto calendar dates with an exclusive end: %s through %s', (start, end) => {
    expect(sessionListQuerySchema.safeParse({ query: { start, end } }).success).toBe(true);
  });

  it.each([
    ['2024-01-01T00:00:00-05:00', '2025-01-02T00:00:00-05:00'],
    ['2026-01-01T23:59:59-05:00', '2027-01-03T00:00:00-05:00'],
    ['2024-03-09T00:00:00-05:00', '2025-03-11T00:00:00-04:00'],
  ])('rejects 367 Toronto dates regardless of elapsed hours: %s through %s', (start, end) => {
    expect(sessionListQuerySchema.safeParse({ query: { start, end } }).success).toBe(false);
  });

  it('accepts equivalent instants with different offsets', () => {
    expect(sessionListQuerySchema.safeParse({ query: {
      start: '2024-11-02T04:00:00Z', end: '2025-11-03T05:00:00Z',
    } }).success).toBe(true);
  });

  it('accepts low calendar years without treating them as 1900-based years', () => {
    expect(sessionListQuerySchema.safeParse({ query: {
      start: '0099-07-01T12:00:00Z', end: '0099-07-02T12:00:00Z',
    } }).success).toBe(true);
  });

  it('rejects year zero', () => {
    expect(sessionListQuerySchema.safeParse({ query: {
      start: '0000-07-01T12:00:00Z', end: '0000-07-02T12:00:00Z',
    } }).success).toBe(false);
  });

  it('preserves requests without a page range', () => {
    expect(sessionListQuerySchema.safeParse({ query: {} }).success).toBe(true);
  });
});

describe('Task lifecycle dates', () => {
  it('does not cap task duration when capping page queries', () => {
    expect(setTaskSchema.safeParse({ body: {
      title: 'Long-running task', category: 'outreach',
      staffId: '11111111-1111-4111-8111-111111111111',
      startDate: '2024-01-01', dueDate: '2026-12-31',
    } }).success).toBe(true);
  });
});
