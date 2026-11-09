import { useState } from 'react';

export type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

interface SubmitStatusMessages {
  submitting: string;
  success?: string;
}

/**
 * Selects the message for a form's current submission phase.
 * @param submitStatus - Current phase; idle has no message.
 * @param error - Failure message, shown only for the error phase.
 * @param messages - Pending message and optional successful-completion message.
 * @example getSubmitStatusMessage('success', '', { submitting: 'Saving', success: 'Saved' }) // Saved
 */
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

/**
 * Holds submission feedback for one mounted form interaction.
 * @example useSubmitStatus().submitStatus // idle when the form mounts
 */
export function useSubmitStatus() {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [error, setError] = useState('');

  return { submitStatus, setSubmitStatus, error, setError };
}
