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
  if (!dateOfBirth) return '\u2014';
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age.toString();
}
