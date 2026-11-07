import { useState } from 'react';
import type { Program } from '../../../../../../common/features/programs/types';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';
import { createSession, type CreatedSessionResult } from '../../../sessions.api';
import { DEFAULT_SESSION_TYPE } from '../../../types';
import { useSessionTypes } from '../../../hooks/data/useSessionTypes';
import { nextSessionDate } from '../../../utils/sessionSchedule';

export default function useAddSessionModal({ programs, initialProgramId, initialDate, onSaved }: {
  programs: Program[];
  initialProgramId?: string;
  initialDate?: string;
  onSaved: (result: CreatedSessionResult) => void | Promise<void>;
}) {
  const [programId, setProgramId] = useState(initialProgramId ?? programs[0]?.id ?? '');
  const program = programs.find(candidate => candidate.id === programId);
  const [draft, setDraft] = useState(() => ({
    sessionType: DEFAULT_SESSION_TYPE,
    theme: '',
    date: initialDate ?? (program ? nextSessionDate(program) : ''),
    startTime: program?.defaultStartTime ?? '',
    endTime: program?.defaultEndTime ?? '',
  }));
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [message, setMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();
  const { sessionTypes } = useSessionTypes();

  const updateDraft = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const selectProgram = (id: string) => {
    if (id === programId) return;
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
    if (!program || !draft.theme.trim() || !draft.sessionType) return;
    if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime) {
      setStatus('error');
      setMessage('End time must be after start time.');
      return;
    }
    if (!tryLock()) return;

    setStatus('submitting');
    setMessage('Adding session...');
    let saved: CreatedSessionResult;
    try {
      saved = await createSession({
        programId,
        sessionType: draft.sessionType,
        theme: draft.theme.trim(),
        date: draft.date,
        startTime: draft.startTime,
        endTime: draft.endTime,
      });
    } catch (cause) {
      setStatus('error');
      setMessage(getErrorMessage(cause, 'Could not add session'));
      unlock();
      return;
    }

    try {
      await onSaved(saved);
      setMessage('Session added successfully.');
    } catch {
      setMessage('Session added, but the page could not refresh. Reload to see it.');
    }
    setStatus('success');
  };

  return { programId, program, draft, updateDraft, selectProgram,
    sessionTypes, status, message, submit, locked: status === 'submitting' || status === 'success' };
}
