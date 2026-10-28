import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getCohorts } from '../../../Programming/Cohorts/cohorts.api';
import useSubmitLock from '../../../../common/hooks/useSubmitLock';
import {
  getSubmitStatusMessage,
  useSubmitStatus,
} from '../../../../common/hooks/useSubmitStatus';
import type { ProgramCohort } from '../../../Programming/Cohorts/types';
import { getErrorMessage } from '../../../../http/errors';

import { signUpLead } from '../../leads.api';
import type { Lead } from '../../types';

export type LeadNoteCategory = 'general' | 'health' | 'preference';

const noCohorts: ProgramCohort[] = [];

interface UseSignUpLeadModalOptions {
  queryKey: readonly unknown[];
  lead: Lead | null;
  onSuccess: (lead: Lead) => void | Promise<void>;
}

export default function useSignUpLeadModal({
  queryKey,
  lead,
  onSuccess,
}: UseSignUpLeadModalOptions) {
  const [cohortId, setCohortId] = useState('');
  const [noteCategory, setNoteCategory] = useState<LeadNoteCategory>('general');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const submitLock = useSubmitLock();
  const leadId = lead?.id;

  const {
    submitStatus,
    setSubmitStatus,
    error,
    setError,
    resetStatus,
  } = useSubmitStatus();

  const {
    data: cohorts = noCohorts,
    error: cohortsError,
    isLoading: loading,
  } = useQuery({
    queryKey: [...queryKey, 'all-programs'],
    queryFn: ({ signal }) => getCohorts(undefined, {}, { signal }),
    enabled: Boolean(lead),
    select: rows => rows.filter(cohort => (
      cohort.state !== 'completed' && cohort.enrollmentRequired
    )),
  });

  // A different lead starts with a clean enrollment and note draft.
  useEffect(() => {
    setCohortId('');
    setNoteCategory('general');
    setSuccessMessage('');
    setShowAllPrograms(false);
    resetStatus();
  }, [leadId, resetStatus]);

  const visibleCohorts = useMemo(() => {
    if (!lead) return cohorts;
    const ageEligible = cohorts.filter(cohort => (
      cohort.minAge == null
      || cohort.maxAge == null
      || (lead.age >= cohort.minAge && lead.age <= cohort.maxAge)
    ));
    return showAllPrograms || !lead.recommendedProgramId
      ? ageEligible
      : ageEligible.filter(cohort => cohort.programId === lead.recommendedProgramId);
  }, [cohorts, lead, showAllPrograms]);

  const submit = async () => {
    if (!lead || !submitLock.tryLock()) return;

    const selectedCohort = cohorts.find(cohort => cohort.id === cohortId);
    const youthName = `${lead.youthFirstName} ${lead.youthLastName}`;
    setSubmitStatus('submitting');
    setError('');
    setSuccessMessage('');

    let updatedLead: Lead;
    try {
      updatedLead = lead.notes?.trim()
        ? await signUpLead(lead.id, cohortId || null, noteCategory)
        : await signUpLead(lead.id, cohortId || null);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to create youth profile'));
      setSubmitStatus('error');
      submitLock.unlock();
      return;
    }

    let refreshFailed = false;
    try {
      await onSuccess(updatedLead);
    } catch {
      refreshFailed = true;
    }

    let nextSuccessMessage = `Youth profile successfully created for ${youthName}.`;
    if (selectedCohort) {
      nextSuccessMessage = `Youth profile successfully created and added to ${selectedCohort.programName} - ${selectedCohort.name}.`;
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
    cohortId,
    selectCohort: setCohortId,
    noteCategory,
    selectNoteCategory: setNoteCategory,
    cohorts,
    visibleCohorts,
    showAllPrograms,
    setShowAllPrograms,
    loading,
    loadError: cohortsError
      ? getErrorMessage(cohortsError, 'Unable to load cohorts')
      : '',
    submitStatus,
    statusMessage,
    submissionComplete,
    submit,
  };
}
