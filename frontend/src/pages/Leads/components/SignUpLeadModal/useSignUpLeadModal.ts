import { useEffect, useMemo, useState } from 'react';
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
import { calculateAge, dateOfBirthSchema } from '../../../../common/features/youth/dateOfBirth';

export type LeadNoteCategory = 'general' | 'health' | 'preference';

const noProgramCycles: ProgramCycleAssignment[] = [];

interface UseSignUpLeadModalOptions {
  queryKey: readonly unknown[];
  lead: Lead | null;
  onSuccess: (result: LeadSignUpResult) => void | Promise<void>;
}

export default function useSignUpLeadModal({
  queryKey,
  lead,
  onSuccess,
}: UseSignUpLeadModalOptions) {
  const [selectedPairKey, setSelectedPairKey] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(lead?.dateOfBirth ?? '');
  const age = calculateAge(dateOfBirth);
  const [noteCategory, setNoteCategory] = useState<LeadNoteCategory>('general');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const submitLock = useSubmitLock();
  const leadId = lead?.id;
  const storedDateOfBirth = lead?.dateOfBirth;

  const {
    submitStatus,
    setSubmitStatus,
    error,
    setError,
    resetStatus,
  } = useSubmitStatus();

  const {
    data: programCycles = noProgramCycles,
    error: programCyclesError,
    isLoading: loading,
  } = useQuery({
    queryKey: [...queryKey, 'all-programs'],
    queryFn: ({ signal }) => getProgramCycleAssignments(undefined, {}, { signal }),
    enabled: Boolean(lead),
    select: rows => rows.filter(programCycle => (
      programCycle.state !== 'completed' && programCycle.enrollmentRequired
    )),
  });

  // A different lead starts with a clean enrollment and note draft.
  useEffect(() => {
    setSelectedPairKey('');
    setDateOfBirth(storedDateOfBirth ?? '');
    setNoteCategory('general');
    setSuccessMessage('');
    setShowAllPrograms(false);
    resetStatus();
  }, [leadId, storedDateOfBirth, resetStatus]);

  const visibleProgramCycles = useMemo(() => {
    if (!lead) return programCycles;
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
    if (!lead || !submitLock.tryLock()) return;

    const birthDateResult = dateOfBirthSchema.safeParse(dateOfBirth);
    if (!birthDateResult.success) {
      setError(birthDateResult.error.issues[0].message);
      setSubmitStatus('error');
      submitLock.unlock();
      return;
    }

    const selectedProgramCycle = visibleProgramCycles.find(programCycle => `${programCycle.programId}:${programCycle.cycleId}` === selectedPairKey);
    const youthName = `${lead.youthFirstName} ${lead.youthLastName}`;
    setSubmitStatus('submitting');
    setError('');
    setSuccessMessage('');

    let saved: LeadSignUpResult;
    try {
      saved = lead.notes?.trim()
        ? await signUpLead(lead.id, selectedProgramCycle ? { programId: selectedProgramCycle.programId, cycleId: selectedProgramCycle.cycleId } : null, noteCategory, dateOfBirth)
        : await signUpLead(lead.id, selectedProgramCycle ? { programId: selectedProgramCycle.programId, cycleId: selectedProgramCycle.cycleId } : null, undefined, dateOfBirth);
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
    submitLock.unlock();
  };

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const statusMessage = getSubmitStatusMessage(submitStatus, error, {
    submitting: lead
      ? `Creating youth profile for ${lead.youthFirstName} ${lead.youthLastName}...`
      : 'Creating youth profile...',
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
