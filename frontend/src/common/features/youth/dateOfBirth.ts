import { z } from 'zod';
import { getDateKeyInTimeZone } from '../../utils/date';

/** Returns completed years on the Toronto calendar day; invalid dates return null. */
export function calculateAge(dateOfBirth: string, today = getDateKeyInTimeZone()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;

  const parsed = new Date(`${dateOfBirth}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOfBirth) return null;

  const birthYear = Number(dateOfBirth.slice(0, 4));
  if (birthYear === 0) return null;
  const year = Number(today.slice(0, 4));
  return year - birthYear - (today.slice(5) < dateOfBirth.slice(5) ? 1 : 0);
}

export const dateOfBirthSchema = z.string().min(1, 'Date of birth is required')
  .pipe(z.iso.date('Enter a valid date of birth'))
  .refine(value => !value.startsWith('0000-'), 'Enter a valid date of birth')
  .refine(value => value < getDateKeyInTimeZone(), 'Date of birth must be before today');

/** Native date-input bounds for a real birthdate before today's Toronto date. */
export function getDateOfBirthBounds(today = getDateKeyInTimeZone()) {
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return { max: yesterday.toISOString().slice(0, 10) };
}
