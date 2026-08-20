import { useEffect, useRef, useState } from 'react';

import { generateSessions } from '../../../../../../common/features/programming/api/sessions.api';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import {
  REGULAR_SESSION_TYPE_ID,
  type GenerateSessionsInput,
  type ProgramCohort,
} from '../../../../../../common/types/cohort';
import { getErrorMessage } from '../../../../../../http/clientErrors';
import { useSessionTypes } from '../../../hooks/useSessionTypes';

type SessionFrequency = GenerateSessionsInput['frequency'];
type SessionWeekday = NonNullable<GenerateSessionsInput['dayOfWeek']>;

interface GenerateSessionsDraft {
  sessionTypeId: string;
  theme: string;
  frequency: SessionFrequency;
  dayOfWeek: SessionWeekday;
  dayOfMonth: string;
  startsOn: string;
  endsOn: string;
  startTime: string;
  endTime: string;
}

interface UseGenerateSessionsModalOptions {
  cohort: ProgramCohort | null;
  cohorts: ProgramCohort[];
  open: boolean;
  initialCohortId?: string;
  onSuccess: () => void | Promise<void>;
}

function initialSelectedCohortId(
  cohort: ProgramCohort | null,
  cohorts: ProgramCohort[],
  initialCohortId?: string,
) {
  if (cohort) return cohort.id;
  if (initialCohortId && cohorts.some(candidate => candidate.id === initialCohortId)) {
    return initialCohortId;
  }
  return cohorts[0]?.id ?? '';
}

function buildDraft(cohort: ProgramCohort | null): GenerateSessionsDraft {
  return {
    sessionTypeId: REGULAR_SESSION_TYPE_ID,
    theme: '',
    frequency: 'weekly',
    dayOfWeek: 'tuesday',
    dayOfMonth: '1',
    startsOn: cohort?.startsOn ?? '',
    endsOn: cohort?.endsOn ?? '',
    startTime: '17:00',
    endTime: '19:30',
  };
}

export default function useGenerateSessionsModal({
  cohort,
  cohorts,
  open,
  initialCohortId,
  onSuccess,
}: UseGenerateSessionsModalOptions) {
  const initialCohortIdRef = useRef(initialSelectedCohortId(cohort, cohorts, initialCohortId));
  const initialCohortRef = useRef(
    cohort ?? cohorts.find(candidate => candidate.id === initialCohortIdRef.current) ?? null,
  );
  const [selectedCohortId, setSelectedCohortId] = useState(initialCohortIdRef.current);
  const [draft, setDraft] = useState(() => buildDraft(initialCohortRef.current));
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { sessionTypes } = useSessionTypes();
  const { tryLock, unlock } = useSubmitLock();

  const nextInitialCohortId = initialSelectedCohortId(cohort, cohorts, initialCohortId);
  const nextInitialCohort = cohort
    ?? cohorts.find(candidate => candidate.id === nextInitialCohortId)
    ?? null;
  initialCohortIdRef.current = nextInitialCohortId;
  initialCohortRef.current = nextInitialCohort;

  const targetKey = open ? nextInitialCohortId || 'select' : 'closed';
  const selectedCohort = cohort
    ?? cohorts.find(candidate => candidate.id === selectedCohortId)
    ?? null;

  // Opening for a different cohort starts a fresh schedule draft.
  useEffect(() => {
    if (!open) return;
    setSelectedCohortId(initialCohortIdRef.current);
    setDraft(buildDraft(initialCohortRef.current));
    setSubmitStatus('idle');
    setStatusMessage('');
    unlock();
  }, [open, targetKey, unlock]);

  // Keep the default type valid after the available session types load.
  useEffect(() => {
    if (!open || !sessionTypes.length) return;
    setDraft(current => ({
      ...current,
      sessionTypeId: sessionTypes.some(type => type.id === current.sessionTypeId)
        ? current.sessionTypeId
        : sessionTypes.find(type => type.name === 'Regular')?.id ?? sessionTypes[0].id,
    }));
  }, [open, sessionTypes]);

  const updateSelectedCohort = (cohortId: string) => {
    const nextCohort = cohorts.find(candidate => candidate.id === cohortId) ?? null;
    setSelectedCohortId(cohortId);
    setDraft(current => ({
      ...current,
      startsOn: nextCohort?.startsOn ?? '',
      endsOn: nextCohort?.endsOn ?? '',
    }));
  };

  const updateDraft = <Key extends keyof GenerateSessionsDraft>(
    key: Key,
    value: GenerateSessionsDraft[Key],
  ) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    const theme = draft.theme.trim();
    const requiredDatesComplete = draft.startsOn
      && (draft.frequency === 'once' || draft.endsOn);
    if (
      !selectedCohort
      || !draft.sessionTypeId
      || !theme
      || !requiredDatesComplete
      || !draft.startTime
      || !draft.endTime
    ) {
      setSubmitStatus('error');
      setStatusMessage('Complete all required session fields.');
      return;
    }
    if (!tryLock()) return;

    setSubmitStatus('submitting');
    setStatusMessage(
      `Adding sessions for ${selectedCohort.programName} - ${selectedCohort.name}...`,
    );

    let result;
    try {
      result = await generateSessions(selectedCohort.id, {
        sessionTypeId: draft.sessionTypeId,
        theme,
        frequency: draft.frequency,
        ...((draft.frequency === 'weekly' || draft.frequency === 'biweekly') && {
          dayOfWeek: draft.dayOfWeek,
        }),
        ...(draft.frequency === 'monthly' && { dayOfMonth: Number(draft.dayOfMonth) }),
        startsOn: draft.startsOn,
        ...(draft.frequency !== 'once' && { endsOn: draft.endsOn }),
        startTime: draft.startTime,
        endTime: draft.endTime,
      });
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not generate sessions'));
      setSubmitStatus('error');
      unlock();
      return;
    }

    let refreshFailed = false;
    try {
      await onSuccess();
    } catch {
      refreshFailed = true;
    }

    const sessionCount = result.sessions.length;
    setStatusMessage(refreshFailed
      ? `${sessionCount} ${sessionCount === 1 ? 'session was' : 'sessions were'} added, but the page could not refresh. Reload to see them.`
      : `${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'} successfully added to ${selectedCohort.programName} - ${selectedCohort.name}.`);
    setSubmitStatus('success');
  };

  return {
    selectedCohort,
    selectedCohortId,
    sessionTypes,
    draft,
    submitStatus,
    statusMessage: statusMessage || undefined,
    submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    updateSelectedCohort,
    updateDraft,
    submit,
  };
}
