/**
 * Format seconds into mm:ss format
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format seconds into human-readable duration
 * Example: 150 seconds -> "2m 30s"
 */
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};

/**
 * Convert milliseconds to seconds
 */
export const msToSeconds = (ms: number): number => Math.floor(ms / 1000);

/**
 * Convert seconds to milliseconds
 */
export const secondsToMs = (seconds: number): number => seconds * 1000;
