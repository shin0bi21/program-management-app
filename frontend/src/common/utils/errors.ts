/**
 * Extract error message from unknown error type
 */
export const getErrorMessage = (err: unknown, fallback = 'An error occurred'): string => {
  if (err instanceof Error) {
    return err.message;
  }
  
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as any).message);
  }
  
  if (typeof err === 'string') {
    return err;
  }
  
  return fallback;
};
