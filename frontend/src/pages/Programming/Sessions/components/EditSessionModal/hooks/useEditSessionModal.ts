import { sessionInstant } from '../../../utils/sessionSchedule';
import { type FormEvent, useEffect, useState } from 'react';
import { updateSession, type UpdatedSessionResult } from '../../../sessions.api';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { CohortSession } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';
import { useSessionTypes } from '../../../hooks/data/useSessionTypes';

export function useEditSessionModal(session: CohortSession | null, onUpdated: (result: UpdatedSessionResult) => void | Promise<void>, timezone = 'America/Toronto') {
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
      const date = String(form.get('date'));
      const startTime = String(form.get('startTime'));
      const endTime = String(form.get('endTime'));
      if (endTime <= startTime) throw new Error('End time must be after start time.');

      const saved = await updateSession(session.id, {
        sessionTypeId,
        theme: String(form.get('theme')).trim(),
        startsAt: sessionInstant(date, startTime, timezone),
        endsAt: sessionInstant(date, endTime, timezone),
        description: String(form.get('description')).trim() || null,
      });
      await onUpdated(saved);
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
