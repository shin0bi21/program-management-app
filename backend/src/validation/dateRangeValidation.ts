import { z } from 'zod';

const isoDateSchema = z.iso.date();

/**
 * Accepts real Gregorian dates in years 0001–9999 using the canonical date-only shape.
 * @param value - Calendar date to validate without timezone interpretation.
 * @example isCalendarDate('2026-02-30') // false
 */
export function isCalendarDate(value: string) {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  return isoDateSchema.safeParse(value).success;
}

/**
 * Builds validation for a required calendar date with field-specific messages.
 * @param label - Field name shown in validation errors.
 * @example calendarDateSchema('Work date').parse('2026-11-10') // '2026-11-10'
 */
export function calendarDateSchema(label = 'Date') {
  return z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must use YYYY-MM-DD`)
    .refine(isCalendarDate, `${label} must be a valid calendar date`);
}

/**
 * Checks that optional range bounds are either both supplied or both omitted.
 * @param range - Optional calendar query bounds.
 * @example hasPairedCalendarBounds({ start: '2026-01-01' }) // false
 */
export function hasPairedCalendarBounds(range: { start?: string; end?: string }) {
  return Boolean(range.start) === Boolean(range.end);
}

/**
 * Checks the order of supplied calendar bounds, including equal dates.
 * @param range - Calendar query bounds; individual dates are validated separately.
 * @example hasOrderedCalendarBounds({ start: '2026-01-01', end: '2027-01-01' }) // true
 */
export function hasOrderedCalendarBounds(range: { start?: string; end?: string }) {
  return !range.start || !range.end || range.start <= range.end;
}
