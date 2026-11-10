import { z } from 'zod';

/**
 * Accepts real Gregorian dates in years 0001–9999 using the canonical date-only shape.
 * @param value - Calendar date to validate without timezone interpretation.
 * @example isCalendarDate('2026-02-30') // false
 */
export function isCalendarDate(value: string) {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
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
