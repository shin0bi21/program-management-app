import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';
import { getDate } from '../../utils/date';

export const dateOfBirthSchema = z.string().min(1, 'Date of birth is required')
  .pipe(z.iso.date('Enter a valid date of birth'))
  .refine(value => !value.startsWith('0000-'), 'Enter a valid date of birth')
  .refine(value => value < getDate(), 'Date of birth must be before today');

/**
 * Supplies native date-input bounds for a birthdate before local today.
 * @param today - YYYY-MM-DD upper boundary, defaulting to the device's local date.
 * @example getDateOfBirthBounds('2026-11-10') // { max: '2026-11-09' }
 */
export function getDateOfBirthBounds(today = getDate()) {
  return { max: Temporal.PlainDate.from(today).subtract({ days: 1 }).toString() };
}
