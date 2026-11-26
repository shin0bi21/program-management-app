import { useState } from 'react';
import type { Program } from '../../../../Programs/types';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';
import type { SetSessionInput } from '../../../sessions.api';
import { type ProgramSession } from '../../../types';
import { nextSessionDate } from '../../../utils/sessionSchedule';

/**
 * Initializes one session draft from a saved session or the selected program's defaults.
 * @param options - Page-owned programs, optional edit session/calendar context, and save callback.
 * @example useSessionModal({ programs, session, onSave, onSaved }) // edits the supplied session without another read
 */
export default function useSessionModal({ programs, session, programId, date, pending = false, onSave, onSaved }: {
  programs: Program[];
  session?: ProgramSession;
  programId?: string;
  date?: string;
  pending?: boolean;
  onSave: (input: SetSessionInput) => Promise<ProgramSession>;
  onSaved: (session: ProgramSession) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(() => {
    const program = programs.find(candidate => candidate.id === (session?.programId ?? programId));
    return {
      programId: session?.programId ?? programId ?? '',
      sessionType: session?.sessionType ?? '',
      title: session?.title ?? '',
      date: session?.date ?? date ?? (program ? nextSessionDate(program) : ''),
      startTime: session?.startTime ?? program?.defaultStartTime ?? '',
      endTime: session?.endTime ?? program?.defaultEndTime ?? '',
      description: session?.description ?? '',
    };
  });
  const program = programs.find(candidate => candidate.id === draft.programId);
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [message, setMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  const updateDraft = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const selectProgram = (id: string) => {
    if (session || id === draft.programId) return;
    const nextProgram = programs.find(candidate => candidate.id === id);
    if (!nextProgram) return;

    setDraft(current => ({
      ...current,
      programId: id,
      date: date ?? nextSessionDate(nextProgram),
      startTime: nextProgram.defaultStartTime,
      endTime: nextProgram.defaultEndTime,
    }));
  };

  const submit = async () => {
    if (pending || (!session && !program) || !draft.title.trim() || !draft.sessionType) return;
    if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime) {
      setStatus('error');
      setMessage('End time must be after start time.');
      return;
    }
    if (!tryLock()) return;

    setStatus('submitting');
    setMessage(session ? 'Updating session...' : 'Adding session...');
    let saved: ProgramSession;
    try {
      const fields = {
        ...(session ? { id: session.id } : { programId: draft.programId }),
        sessionType: draft.sessionType,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        date: draft.date,
        startTime: draft.startTime,
        endTime: draft.endTime,
      };
      saved = await onSave(fields);
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

  return { program, draft, updateDraft, selectProgram,
    status, message, submit, locked: pending || status === 'submitting' || status === 'success' };
}
