import { useCallback, useState } from 'react';

export type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

interface SubmitStatusMessages {
  submitting: string;
  success?: string;
}

export function getSubmitStatusMessage(
  submitStatus: SubmitStatus,
  error: string,
  messages: SubmitStatusMessages,
) {
  if (submitStatus === 'submitting') return messages.submitting;
  if (submitStatus === 'success') return messages.success;
  if (submitStatus === 'error') return error || undefined;
  return undefined;
}

export function useSubmitStatus() {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [error, setError] = useState('');

  const resetStatus = useCallback(() => {
    setSubmitStatus('idle');
    setError('');
  }, []);

  return { submitStatus, setSubmitStatus, error, setError, resetStatus };
}
