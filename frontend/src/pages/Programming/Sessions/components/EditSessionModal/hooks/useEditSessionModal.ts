import { sessionInstant } from '../../../utils/sessionSchedule';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { updateSession, type UpdatedSessionResult } from '../../../sessions.api';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { ProgramSession } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';
import { useSessionTypes } from '../../../hooks/data/useSessionTypes';

/**
 * Owns the session type draft and save lifecycle without resetting on shared record updates.
 * @example useEditSessionModal(session, onUpdated) // resets only for a new target
 */
export function useEditSessionModal(session: ProgramSession | null, onUpdated: (result: UpdatedSessionResult) => void | Promise<void>, timezone = 'America/Toronto') {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [sessionType, setSessionType] = useState('');
  const { sessionTypes } = useSessionTypes();
  const { tryLock, unlock } = useSubmitLock();

  const initialTypeRef = useRef(session?.sessionType);
  initialTypeRef.current = session?.sessionType;
  const sessionId = session?.id;

  // Only a new target starts a draft; refreshed session inputs preserve fields and the save lock.
  useEffect(() => {
    if (!sessionId) return;
    setStatus('idle');
    setStatusMessage('');
    setSessionType(initialTypeRef.current!);
    unlock();
  }, [sessionId, unlock]);

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
        sessionType,
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
    sessionType,
    setSessionType,
    sessionTypes,
    submit,
  };
}
