import { useState } from 'react';
import type { Program } from '../../../../Programs/types';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';
import type { setSession } from '../../../sessions.api';
import type { Session } from '../../../../../../common/features/programming/sessions/types';
import { nextSessionDate } from '../../../utils/sessionSchedule';

export interface SessionModalOptions {
  programs: Program[];
  session?: Session;
  programId?: string;
  date?: string;
  pending?: boolean;
  onSave: typeof setSession;
  onSaved: (session: Session) => void | Promise<void>;
}

interface SessionModalWorkflow {
  program: Program | undefined;
  draft: ReturnType<typeof createSessionDraft>;
  updateDraft: <Key extends keyof SessionModalWorkflow['draft']>(
    key: Key,
    value: SessionModalWorkflow['draft'][Key],
  ) => void;
  selectProgram: (id: string) => void;
  status: SubmitStatus;
  message: string;
  submit: () => Promise<void>;
  locked: boolean;
}

/**
 * Initializes one session draft from a saved session or the selected program's defaults.
 * @param options - Page-owned programs, optional edit session/calendar context, and save callbacks.
 * @example useSessionModal({ programs, session, onSave, onSaved }) // edits the supplied session without another read
 */
export default function useSessionModal({
  programs,
  session,
  programId,
  date,
  pending = false,
  onSave,
  onSaved,
}: SessionModalOptions): SessionModalWorkflow {
  const [draft, setDraft] = useState(() => createSessionDraft({ programs, session, programId, date }));
  const program = programs.find(candidate => candidate.id === draft.programId);
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [message, setMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  const updateDraft: SessionModalWorkflow['updateDraft'] = (key, value) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

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
    let saved: Session;
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

  return {
    program,
    draft,
    updateDraft,
    selectProgram,
    status,
    message,
    submit,
    locked: pending || status === 'submitting' || status === 'success',
  };
}

/**
 * Builds the initial form values from a saved session or calendar and program defaults.
 * @param options - Available programs and the context that opened the editor.
 * @example createSessionDraft({ programs, session }) // pre-fills the saved session
 */
function createSessionDraft({
  programs,
  session,
  programId,
  date,
}: Pick<SessionModalOptions, 'programs' | 'session' | 'programId' | 'date'>) {
  const program = programs.find(candidate => candidate.id === (session?.programId ?? programId));
  const sessionType: Session['sessionType'] | '' = session?.sessionType ?? '';
  return {
    programId: session?.programId ?? programId ?? '',
    sessionType,
    title: session?.title ?? '',
    date: session?.date ?? date ?? (program ? nextSessionDate(program) : ''),
    startTime: session?.startTime ?? program?.defaultStartTime ?? '',
    endTime: session?.endTime ?? program?.defaultEndTime ?? '',
    description: session?.description ?? '',
  };
}
