/**
 * Format seconds into mm:ss format.
 * Used for countdown displays (e.g. 2FA timer).
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Calculate age from a date-of-birth string.
 * Returns '\u2014' if dateOfBirth is null/undefined.
 */
export function calculateAge(dateOfBirth: string | null | undefined): string {
  const age = getAge(dateOfBirth);
  return age === null ? '\u2014' : age.toString();
}

export function getAge(dateOfBirth: string | null | undefined, today = new Date()): number | null {
  if (!dateOfBirth) return null;
  const [year, month, day] = dateOfBirth.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
    age--;
  }
  return age;
}
