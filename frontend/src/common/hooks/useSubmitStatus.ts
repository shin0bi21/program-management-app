import { useCallback, useState } from 'react';

export type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export function useSubmitStatus() {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [error, setError] = useState('');

  const resetStatus = useCallback(() => {
    setSubmitStatus('idle');
    setError('');
  }, []);

  return { submitStatus, setSubmitStatus, error, setError, resetStatus };
}
