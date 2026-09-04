import { type FormEvent, useEffect, useState } from 'react';
import { updateSession } from '../../../sessions.api';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { CohortSession } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';
import { useSessionTypes } from '../../../hooks/data/useSessionTypes';

export function useEditSessionModal(session: CohortSession | null, onUpdated: () => void | Promise<void>) {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [sessionTypeId, setSessionTypeId] = useState('');
  const { sessionTypes } = useSessionTypes();
  const { tryLock, unlock } = useSubmitLock();

  useEffect(() => {
    if (!session) return;
    setStatus('idle');
    setStatusMessage('');
    setSessionTypeId(session.sessionTypeId);
    unlock();
  }, [session, unlock]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || !tryLock()) return;

    const form = new FormData(event.currentTarget);
    setStatus('submitting');
    setStatusMessage('Updating session...');

    try {
      await updateSession(session.id, {
        sessionTypeId,
        theme: String(form.get('theme')).trim(),
        startsAt: new Date(String(form.get('startsAt'))).toISOString(),
        endsAt: new Date(String(form.get('endsAt'))).toISOString(),
        description: String(form.get('description')).trim() || null,
      });
      await onUpdated();
      setStatusMessage('Session updated successfully.');
      setStatus('success');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not update session'));
      setStatus('error');
      unlock();
    }
  };

  return {
    status,
    statusMessage,
    submissionComplete: status === 'submitting' || status === 'success',
    sessionTypeId,
    setSessionTypeId,
    sessionTypes,
    submit,
  };
}
