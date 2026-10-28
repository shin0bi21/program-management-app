import { z } from 'zod';
import { getDateKeyInTimeZone } from '../../utils/date';

/** Returns completed years on the Toronto calendar day; invalid dates return null. */
export function calculateOutreachAge(dateOfBirth: string, today = getDateKeyInTimeZone()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;

  const parsed = new Date(`${dateOfBirth}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOfBirth) return null;

  const birthYear = Number(dateOfBirth.slice(0, 4));
  if (birthYear === 0) return null;
  const year = Number(today.slice(0, 4));
  return year - birthYear - (today.slice(5) < dateOfBirth.slice(5) ? 1 : 0);
}

export const outreachDateOfBirthSchema = z.string().min(1, 'Date of birth is required').superRefine((value, context) => {
  if (!value) return;

  const age = calculateOutreachAge(value);
  if (age === null) {
    context.addIssue({ code: 'custom', message: 'Enter a valid date of birth' });
  } else if (age < 12 || age > 19) {
    context.addIssue({ code: 'custom', message: 'Youth must be between 12 and 19 years old' });
  }
});

/** Inclusive birth dates for completed ages 12–19 on today's Toronto date. */
export function getOutreachDateOfBirthBounds(today = getDateKeyInTimeZone()) {
  const year = Number(today.slice(0, 4));
  const monthDay = today.slice(5);
  const cutoff = new Date(`${year - 20}-${monthDay}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() + 1);
  return { min: cutoff.toISOString().slice(0, 10), max: `${year - 12}-${monthDay}` };
}
