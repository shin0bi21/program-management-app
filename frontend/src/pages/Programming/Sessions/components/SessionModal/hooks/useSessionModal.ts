import { useState } from 'react';
import type { Program } from '../../../../../../common/features/programs/types';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';
import { createSession, updateSession, type CreatedSessionResult, type UpdatedSessionResult } from '../../../sessions.api';
import { DEFAULT_SESSION_TYPE, type ProgramSession } from '../../../types';
import { nextSessionDate, sessionDateTime, sessionInstant } from '../../../utils/sessionSchedule';

/**
 * Initializes one session draft from a saved session or the selected program's defaults.
 * @param options - Page-owned programs, optional edit session/calendar context, and save callback.
 * @example useSessionModal({ programs, session, onSaved }) // edits the supplied session without another read
 */
export default function useSessionModal({ programs, session, initialProgramId, initialDate, onSaved }: {
  programs: Program[];
  session?: ProgramSession;
  initialProgramId?: string;
  initialDate?: string;
  onSaved: (result: CreatedSessionResult | UpdatedSessionResult) => void | Promise<void>;
}) {
  const [programId, setProgramId] = useState(session?.programId ?? initialProgramId ?? programs[0]?.id ?? '');
  const program = programs.find(candidate => candidate.id === programId);
  const timezone = program?.timezone ?? 'America/Toronto';
  const [draft, setDraft] = useState(() => {
    const startsAt = session ? sessionDateTime(session.startsAt, timezone) : null;
    const endsAt = session ? sessionDateTime(session.endsAt, timezone) : null;
    return {
      sessionType: session?.sessionType ?? DEFAULT_SESSION_TYPE,
      theme: session?.theme ?? '',
      date: startsAt?.date ?? initialDate ?? (program ? nextSessionDate(program) : ''),
      startTime: startsAt?.time ?? program?.defaultStartTime ?? '',
      endTime: endsAt?.time ?? program?.defaultEndTime ?? '',
      description: session?.description ?? '',
    };
  });
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [message, setMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  const updateDraft = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const selectProgram = (id: string) => {
    if (session || id === programId) return;
    const nextProgram = programs.find(candidate => candidate.id === id);
    if (!nextProgram) return;

    setProgramId(id);
    setDraft(current => ({
      ...current,
      date: initialDate ?? nextSessionDate(nextProgram),
      startTime: nextProgram.defaultStartTime,
      endTime: nextProgram.defaultEndTime,
    }));
  };

  const submit = async () => {
    if ((!session && !program) || !draft.theme.trim() || !draft.sessionType) return;
    if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime) {
      setStatus('error');
      setMessage('End time must be after start time.');
      return;
    }
    if (!tryLock()) return;

    setStatus('submitting');
    setMessage(session ? 'Updating session...' : 'Adding session...');
    let saved: CreatedSessionResult | UpdatedSessionResult;
    try {
      const fields = {
        sessionType: draft.sessionType,
        theme: draft.theme.trim(),
        description: draft.description.trim() || null,
      };
      saved = session
        ? await updateSession(session.id, {
          ...fields,
          startsAt: sessionInstant(draft.date, draft.startTime, timezone),
          endsAt: sessionInstant(draft.date, draft.endTime, timezone),
        })
        : await createSession({
          ...fields, programId, date: draft.date, startTime: draft.startTime, endTime: draft.endTime,
        });
    } catch (cause) {
      setStatus('error');
      setMessage(getErrorMessage(cause, session ? 'Could not update session' : 'Could not add session'));
      unlock();
      return;
    }

    try {
      await onSaved(saved);
      setMessage(session ? 'Session updated successfully.' : 'Session added successfully.');
    } catch {
      setMessage(session
        ? 'Session updated, but the page could not refresh. Reload to see it.'
        : 'Session added, but the page could not refresh. Reload to see it.');
    }
    setStatus('success');
  };

  return { programId, program, draft, updateDraft, selectProgram,
    status, message, submit, locked: status === 'submitting' || status === 'success' };
}
