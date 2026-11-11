import { isDateKey } from './dateRange';
import { getDate } from './date';

/**
 * Format seconds into mm:ss format.
 * Used for countdown displays (e.g. 2FA timer).
 * @example formatTime(90) // '1:30'
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/** Returns completed years on the supplied date, defaulting to device-local today. @example getAge('2010-08-07', '2026-08-06') // 15 */
export function getAge(dateOfBirth: string | null | undefined, today = getDate()): number | null {
  if (!isDateKey(dateOfBirth)) return null;
  return Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4))
    - (today.slice(5) < dateOfBirth.slice(5) ? 1 : 0);
}
