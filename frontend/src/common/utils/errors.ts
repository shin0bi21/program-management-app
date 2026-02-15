/**
 * Throw if response is not ok, parsing the error message from JSON body
 */
export async function handleApiError(res: Response) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || err.message || 'Request failed');
  }
}

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
