import { useState } from 'react';

import { createProgram, updateProgram, type CreateProgramInput, type ProgramMutationResult } from '../../../api/programs.api';
import type { Program, ProgramWeekday } from '../../../../../../common/features/programs/types';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';

interface ProgramDraft {
  title: string;
  description: string;
  enrollmentRequired: boolean;
  minAge: string;
  maxAge: string;
  defaultDayOfWeek: ProgramWeekday | '';
  defaultStartTime: string;
  defaultEndTime: string;
  timezone: Program['timezone'];
}

interface UseProgramModalOptions {
  program: Program | null;
  onSaved: (result: ProgramMutationResult, operation: 'create' | 'update') => void;
}

type ParsedAges =
  | { error: string }
  | { minAge: number | null; maxAge: number | null };

/**
 * Owns one mounted program editor and saves its supplied record or a new program.
 * @param options - Saved program, if editing, and authoritative save callback.
 * @example useProgramModal({ program: null, onSaved }) // empty new-program draft
 */
export default function useProgramModal({ program, onSaved }: UseProgramModalOptions) {
  const [draft, setDraft] = useState<ProgramDraft>(() => ({
    title: program?.title ?? '',
    description: program?.description ?? '',
    enrollmentRequired: program?.enrollmentRequired ?? false,
    minAge: program?.minAge == null ? '' : String(program.minAge),
    maxAge: program?.maxAge == null ? '' : String(program.maxAge),
    defaultDayOfWeek: program?.defaultDayOfWeek ?? '',
    defaultStartTime: program?.defaultStartTime ?? '',
    defaultEndTime: program?.defaultEndTime ?? '',
    timezone: program?.timezone ?? 'America/Toronto',
  }));
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  const updateDraft = <Key extends keyof ProgramDraft>(
    key: Key,
    value: ProgramDraft[Key],
  ) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    const title = draft.title.trim();
    if (!title) {
      setSubmitStatus('error');
      setStatusMessage('Program title is required.');
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

    if (!draft.defaultDayOfWeek) {
      setSubmitStatus('error');
      setStatusMessage('Default session day is required.');
      return;
    }

    if (!tryLock()) return;

    const input: CreateProgramInput = {
      title,
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
    setStatusMessage(program ? `Updating ${title}...` : `Adding ${title}...`);

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

/**
 * Validates the optional paired age limits as whole years from zero through thirty.
 * @param draft - The form's minimum and maximum age text.
 * @example parseAges({ minAge: '', maxAge: '' }) // no age limits
 */
function parseAges(draft: Pick<ProgramDraft, 'minAge' | 'maxAge'>): ParsedAges {
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
