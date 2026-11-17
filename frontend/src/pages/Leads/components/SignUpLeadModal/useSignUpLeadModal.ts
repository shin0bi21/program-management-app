import { getAge } from '../../../../common/utils/time';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getProgramCycleAssignments } from '../../../Programming/Programs/api/programCycleAssignments.api';
import useSubmitLock from '../../../../common/hooks/useSubmitLock';
import {
  getSubmitStatusMessage,
  useSubmitStatus,
} from '../../../../common/hooks/useSubmitStatus';
import type { ProgramCycleAssignment } from '../../../Programming/Programs/types';
import { getErrorMessage } from '../../../../http/errors';

import { signUpLead } from '../../leads.api';
import type { Lead } from '../../types';
import type { LeadSignUpResult } from '../../leads.api';
import { dateOfBirthSchema } from '../../../../common/features/youth/dateOfBirth';

export type LeadNoteCategory = 'general' | 'health' | 'preference';

const noProgramCycles: ProgramCycleAssignment[] = [];

interface UseSignUpLeadModalOptions {
  queryKey: readonly unknown[];
  lead: Lead;
  onSuccess: (result: LeadSignUpResult) => void | Promise<void>;
}

/**
 * Owns a lead's enrollment draft and creates a youth profile after validating its birth date.
 * The opening modal mounts a new instance for each lead.
 * @param options - Current lead, assignment query key, and authoritative save callback.
 * @example useSignUpLeadModal({ queryKey, lead, onSuccess })
 */
export default function useSignUpLeadModal({
  queryKey,
  lead,
  onSuccess,
}: UseSignUpLeadModalOptions) {
  const [dateOfBirth, setDateOfBirth] = useState(lead.dateOfBirth ?? '');
  const [selectedPairKey, setSelectedPairKey] = useState('');
  const [noteCategory, setNoteCategory] = useState<LeadNoteCategory | ''>('');
  const age = getAge(dateOfBirth);
  const [successMessage, setSuccessMessage] = useState('');
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const submitLock = useSubmitLock();
  const {
    submitStatus,
    setSubmitStatus,
    error,
    setError,
  } = useSubmitStatus();

  const {
    data: programCycles = noProgramCycles,
    error: programCyclesError,
    isLoading: loading,
  } = useQuery({
    queryKey: [...queryKey, 'all-programs'],
    queryFn: ({ signal }) => getProgramCycleAssignments(undefined, {}, { signal }),
    select: rows => rows.filter(programCycle => (
      programCycle.state !== 'completed' && programCycle.enrollmentRequired
    )),
  });

  const visibleProgramCycles = useMemo(() => {
    if (!dateOfBirthSchema.safeParse(dateOfBirth).success) return [];

    const ageEligible = programCycles.filter(programCycle => (
      typeof age === 'number'
      && (programCycle.minAge == null || age >= programCycle.minAge)
      && (programCycle.maxAge == null || age <= programCycle.maxAge)
    ));
    return showAllPrograms || !lead.recommendedProgramId || dateOfBirth !== lead.dateOfBirth
      ? ageEligible
      : ageEligible.filter(programCycle => programCycle.programId === lead.recommendedProgramId);
  }, [programCycles, lead, showAllPrograms, age, dateOfBirth]);

  const submit = async () => {
    const birthDateResult = dateOfBirthSchema.safeParse(dateOfBirth);
    if (!birthDateResult.success) {
      setError(birthDateResult.error.issues[0].message);
      setSubmitStatus('error');
      return;
    }
    if (lead.notes?.trim() && !noteCategory) {
      setError('Choose a type for the intake note.');
      setSubmitStatus('error');
      return;
    }
    if (!submitLock.tryLock()) return;

    const selectedProgramCycle = visibleProgramCycles.find(programCycle => `${programCycle.programId}:${programCycle.cycleId}` === selectedPairKey);
    const youthName = `${lead.youthFirstName} ${lead.youthLastName}`;
    setSubmitStatus('submitting');
    setError('');
    setSuccessMessage('');

    let saved: LeadSignUpResult;
    try {
      const enrollment = selectedProgramCycle
        ? { programId: selectedProgramCycle.programId, cycleId: selectedProgramCycle.cycleId }
        : null;
      const intakeNoteCategory = lead.notes?.trim() && noteCategory ? noteCategory : undefined;
      saved = await signUpLead(lead.id, enrollment, intakeNoteCategory, dateOfBirth);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to create youth profile'));
      setSubmitStatus('error');
      submitLock.unlock();
      return;
    }

    let refreshFailed = false;
    try {
      await onSuccess(saved);
    } catch {
      refreshFailed = true;
    }

    let nextSuccessMessage = `Youth profile successfully created for ${youthName}.`;
    if (selectedProgramCycle) {
      nextSuccessMessage = `Youth profile successfully created and added to ${selectedProgramCycle.program} - ${selectedProgramCycle.cycle}.`;
    }
    if (refreshFailed) {
      nextSuccessMessage = 'Youth profile was created, but the page could not refresh. Reload to see it.';
    }

    setSuccessMessage(nextSuccessMessage);
    setSubmitStatus('success');
  };

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const statusMessage = getSubmitStatusMessage(submitStatus, error, {
    submitting: `Creating youth profile for ${lead.youthFirstName} ${lead.youthLastName}...`,
    success: successMessage,
  });

  return {
    dateOfBirth,
    age,
    changeDateOfBirth: (value: string) => {
      setDateOfBirth(value);
      setSelectedPairKey('');
    },
    selectedPairKey,
    selectProgramCycle: setSelectedPairKey,
    noteCategory,
    selectNoteCategory: setNoteCategory,
    programCycles,
    visibleProgramCycles,
    showAllPrograms,
    setShowAllPrograms,
    loading,
    loadError: programCyclesError
      ? getErrorMessage(programCyclesError, 'Unable to load program cycles')
      : '',
    submitStatus,
    statusMessage,
    submissionComplete,
    submit,
  };
}
