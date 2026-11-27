import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';

import {
  getAttendanceYouth,
  setSessionAttendance,
  type SessionAttendanceResult,
  type SessionAttendanceRecord,
  type AttendanceYouth,
} from '../../../sessions.api';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import type { AttendanceStatus } from '../../../../../../common/features/AttendanceStatusSelect/types';
import type { Session } from '../../../../../../common/features/programming/sessions/types';
import type { SessionRosterMember } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';

const SESSION_QUERY_KEY = ['sessions'] as const;

interface UseSessionAttendanceModalOptions {
  session: Session;
  roster: SessionRosterMember[];
  onSaved: (result: SessionAttendanceResult) => void | Promise<void>;
}

/**
 * Edits attendance supplied by the opening dashboard for one mounted session form.
 * Open sessions check youth in as present; enrolled sessions edit roster statuses.
 * @param options.session - Saved session whose attendance is being edited.
 * @param options.roster - Already-loaded attendance supplied when the form opens.
 * @param options.onSaved - Reconciles saved attendance before success feedback appears.
 * @example Checking a new youth enables Save without changing supplied attendance.
 */
export default function useSessionAttendanceModal({
  session,
  roster,
  onSaved,
}: UseSessionAttendanceModalOptions) {
  const { tryLock, unlock } = useSubmitLock();
  const { watch, getValues, setValue, handleSubmit } = useForm<{ selectedYouthIds: string[]; selections: Record<string, AttendanceStatus | ''> }>({
    defaultValues: {
      selectedYouthIds: roster.map(member => member.youthId),
      selections: Object.fromEntries(roster.map(member => [member.youthId, member.status ?? ''])),
    },
  });
  const { selectedYouthIds, selections } = watch();
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const isOpenRoster = !session.enrollmentRequired;
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  const youthQuery = useQuery<AttendanceYouth[]>({
    queryKey: [...SESSION_QUERY_KEY, 'attendance-youth'],
    queryFn: ({ signal }) => getAttendanceYouth({ signal }),
    enabled: isOpenRoster,
  });
  const youthUnavailable = isOpenRoster && Boolean(youthQuery.error);
  const attendanceLoading = isOpenRoster && youthQuery.isLoading;
  const attendanceUnavailable = youthUnavailable;
  const controlsDisabled = submissionComplete || attendanceLoading || attendanceUnavailable;

  const youth = [...(youthQuery.data ?? [])];
  const youthIds = new Set(youth.map(profile => profile.id));
  // Keep saved attendees available even if the current youth lookup no longer includes them.
  for (const member of roster) {
    if (!youthIds.has(member.youthId)) {
      youth.push({ id: member.youthId, firstName: member.firstName, lastName: member.lastName });
    }
  }
  youth.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const savedYouthIds = new Set(roster.map(member => member.youthId));
  const hasAttendanceChanges = selectedYouthIds.length !== savedYouthIds.size
    || selectedYouthIds.some(youthId => !savedYouthIds.has(youthId));
  const noOpenAttendanceChanges = isOpenRoster && !hasAttendanceChanges;
  const emptyEnrolledRoster = !isOpenRoster && roster.length === 0;
  const submitDisabled = controlsDisabled || noOpenAttendanceChanges || emptyEnrolledRoster;

  /**
   * Checks or unchecks an available youth in an editable open-session draft.
   * @param youthId - ID from the available youth list, including saved attendees.
   * @example Toggling a saved attendee off removes their ID from the next replacement.
   */
  const toggleOpenAttendee = (youthId: string) => {
    if (!isOpenRoster || controlsDisabled) return;

    if (!youth.some(profile => profile.id === youthId)) return;

    const ids = getValues('selectedYouthIds');
    setValue('selectedYouthIds', ids.includes(youthId)
      ? ids.filter(id => id !== youthId)
      : [...ids, youthId]);
  };

  /**
   * Changes a roster member's draft status while editing is available.
   * @param youthId - ID of the enrolled roster member being edited.
   * @param status - Attendance choice; an empty choice omits the member from the saved records.
   * @example Setting a member to 'absent' leaves the loaded roster record untouched.
   */
  const updateAttendanceStatus = (youthId: string, status: AttendanceStatus | '') => {
    if (controlsDisabled) return;

    setValue('selections', { ...getValues('selections'), [youthId]: status });
  };

  /**
   * Saves an eligible draft once, then awaits page reconciliation before showing success.
   * Failed writes unlock for retry; unchanged open rosters cannot submit.
   * @returns Resolves after saving and page reconciliation, or after recording a write failure.
   * @example An unchecked open roster saves [] only when it differs from saved attendance.
   */
  const submit = handleSubmit(async ({ selectedYouthIds, selections }) => {
    if (submitDisabled || !tryLock()) return;

    const sessionTitle = session.title || `${session.program} session`;
    const attendance: SessionAttendanceRecord[] = [];
    if (isOpenRoster) {
      for (const youthId of selectedYouthIds) {
        const savedMember = roster.find(member => member.youthId === youthId);
        attendance.push({
          youthId,
          status: 'present',
          notes: savedMember?.notes ?? null,
        });
      }
    } else {
      for (const member of roster) {
        const status = selections[member.youthId];
        if (!status) continue;

        attendance.push({ youthId: member.youthId, status, notes: member.notes });
      }
    }

    setSubmitStatus('submitting');
    setStatusMessage(`Saving attendance for ${sessionTitle}...`);

    let saved: SessionAttendanceResult;
    try {
      saved = await setSessionAttendance(session.id, attendance);
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not save attendance'));
      setSubmitStatus('error');
      unlock();
      return;
    }

    let refreshFailed = false;
    try {
      await onSaved(saved);
    } catch {
      refreshFailed = true;
    }

    setStatusMessage(refreshFailed
      ? 'Attendance was saved, but the page could not refresh. Reload to see it.'
      : `Attendance successfully saved for ${sessionTitle}.`);
    setSubmitStatus('success');
  });

  return {
    roster,
    selectedYouthIds,
    hasAttendanceChanges,
    selections,
    youth,
    isOpenRoster,
    attendanceLoading,
    attendanceUnavailable,
    controlsDisabled,
    submitDisabled,
    youthUnavailable,
    youthError: isOpenRoster && youthQuery.error
      ? getErrorMessage(youthQuery.error, 'Could not load youth profiles')
      : null,
    submitStatus,
    statusMessage: statusMessage || undefined,
    submissionComplete,
    toggleOpenAttendee,
    updateAttendanceStatus,
    submit,
  };
}
