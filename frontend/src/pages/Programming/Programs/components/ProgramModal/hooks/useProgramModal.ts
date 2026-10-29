import { useEffect, useRef, useState } from 'react';

import { createProgram, updateProgram, type CreateProgramInput, type ProgramMutationResult } from '../../../api/programs.api';
import type { Program, ProgramWeekday } from '../../../../../../common/features/programs/types';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';

interface ProgramDraft {
  name: string;
  description: string;
  enrollmentRequired: boolean;
  minAge: string;
  maxAge: string;
  defaultDayOfWeek: ProgramWeekday;
  defaultStartTime: string;
  defaultEndTime: string;
  timezone: Program['timezone'];
}

interface UseProgramModalOptions {
  isOpen: boolean;
  program: Program | null;
  onSaved: (result: ProgramMutationResult, operation: 'create' | 'update') => void;
}

function buildDraft(program: Program | null): ProgramDraft {
  return {
    defaultDayOfWeek: program?.defaultDayOfWeek ?? 'tuesday',
    defaultStartTime: program?.defaultStartTime ?? '17:00',
    defaultEndTime: program?.defaultEndTime ?? '19:30',
    timezone: program?.timezone ?? 'America/Toronto',
    name: program?.name ?? '',
    description: program?.description ?? '',
    enrollmentRequired: program?.enrollmentRequired ?? true,
    minAge: program?.minAge === null || program?.minAge === undefined
      ? ''
      : String(program.minAge),
    maxAge: program?.maxAge === null || program?.maxAge === undefined
      ? ''
      : String(program.maxAge),
  };
}

type ParsedAges =
  | { error: string }
  | { minAge: number | null; maxAge: number | null };

function parseAges(draft: ProgramDraft): ParsedAges {
  const hasMinAge = draft.minAge !== '';
  const hasMaxAge = draft.maxAge !== '';
  if (hasMinAge !== hasMaxAge) {
    return { error: 'Minimum and maximum age must both be provided.' };
  }
  if (!hasMinAge) return { minAge: null, maxAge: null };

  const minAge = Number(draft.minAge);
  const maxAge = Number(draft.maxAge);
  if (
    !Number.isInteger(minAge)
    || !Number.isInteger(maxAge)
    || minAge < 0
    || minAge > 30
    || maxAge < 0
    || maxAge > 30
  ) {
    return { error: 'Ages must be whole numbers from 0 to 30.' };
  }
  if (minAge > maxAge) {
    return { error: 'Minimum age cannot be greater than maximum age.' };
  }
  return { minAge, maxAge };
}

export default function useProgramModal({ isOpen, program, onSaved }: UseProgramModalOptions) {
  const initialDraftRef = useRef(buildDraft(program));
  const [draft, setDraft] = useState(initialDraftRef.current);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();
  initialDraftRef.current = buildDraft(program);

  const targetKey = isOpen ? program?.id ?? 'new' : 'closed';

  // A different program target starts a fresh editor lifecycle.
  useEffect(() => {
    if (!isOpen) return;
    setDraft(initialDraftRef.current);
    setSubmitStatus('idle');
    setStatusMessage('');
    unlock();
  }, [isOpen, targetKey, unlock]);

  const updateDraft = <Key extends keyof ProgramDraft>(
    key: Key,
    value: ProgramDraft[Key],
  ) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    const name = draft.name.trim();
    if (!name) {
      setSubmitStatus('error');
      setStatusMessage('Program name is required.');
      return;
    }

    const ages = parseAges(draft);
    if ('error' in ages) {
      setSubmitStatus('error');
      setStatusMessage(ages.error);
      return;
    }
    if (!draft.defaultStartTime || !draft.defaultEndTime || draft.defaultEndTime <= draft.defaultStartTime) {
      setSubmitStatus('error');
      setStatusMessage('Default end time must be after the start time.');
      return;
    }

    if (!tryLock()) return;

    const input: CreateProgramInput = {
      name,
      description: draft.description.trim() || null,
      enrollmentRequired: draft.enrollmentRequired,
      minAge: ages.minAge,
      maxAge: ages.maxAge,
      defaultDayOfWeek: draft.defaultDayOfWeek,
      defaultStartTime: draft.defaultStartTime,
      defaultEndTime: draft.defaultEndTime,
      timezone: draft.timezone,
    };
    setSubmitStatus('submitting');
    setStatusMessage(program ? `Updating ${name}...` : `Adding ${name}...`);

    let saved;
    try {
      saved = program
        ? await updateProgram(program.id, input)
        : await createProgram(input);
    } catch (cause) {
      setStatusMessage(getErrorMessage(
        cause,
        program ? 'Could not update program' : 'Could not create program',
      ));
      setSubmitStatus('error');
      unlock();
      return;
    }

    onSaved(saved, program ? 'update' : 'create');
    setStatusMessage(program ? 'Program updated successfully.' : 'Program added successfully.');
    setSubmitStatus('success');
  };

  return {
    draft,
    submitStatus,
    statusMessage: statusMessage || undefined,
    submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    updateDraft,
    submit,
  };
}
