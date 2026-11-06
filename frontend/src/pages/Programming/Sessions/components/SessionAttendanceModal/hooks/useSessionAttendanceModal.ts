import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  getSessionRoster,
  getAttendanceYouth,
  setSessionAttendance,
  type SessionAttendanceResult,
  type SessionAttendanceRecord,
  type AttendanceYouth,
} from '../../../sessions.api';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import type { AttendanceStatus } from '../../../../../../common/features/AttendanceStatusSelect/types';
import type { ProgramSession, SessionRosterMember } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';

const SESSION_QUERY_KEY = ['sessions'] as const;

interface UseSessionAttendanceModalOptions {
  session: ProgramSession | null;
  onSaved: (result: SessionAttendanceResult) => void | Promise<void>;
}

/**
 * Edits attendance for one session, with a fresh draft when the session changes.
 * Open sessions check youth in as present; enrolled sessions edit each roster member's status.
 * Initial roster loading/failure and open-session youth loading/failure block editing and saving.
 * Open-session saves replace attendance with checked youth and preserve their saved notes.
 * @param options.session - Session whose attendance is being edited; null disables roster loading.
 * Keep the target unchanged while submitting; a target change resets the draft but does not cancel a write.
 * @param options.onSaved - Receives saved attendance before success is shown; a callback failure
 * reports that the save succeeded but page refresh failed.
 * @returns Draft values, request feedback, editing guards, and actions for the modal.
 * @example Checking one new youth enables Save without modifying the loaded roster or youth records.
 */
export default function useSessionAttendanceModal({
  session,
  onSaved,
}: UseSessionAttendanceModalOptions) {
  const draftDirtyRef = useRef(false);
  const { tryLock, unlock } = useSubmitLock();
  const sessionId = session?.id;

  const [roster, setRoster] = useState<SessionRosterMember[]>([]);
  const [selectedYouthIds, setSelectedYouthIds] = useState<string[]>([]);
  const [selections, setSelections] = useState<Record<string, AttendanceStatus | ''>>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const isOpenRoster = session !== null && !session.enrollmentRequired;
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  // A different session starts a fresh attendance draft and submission lifecycle.
  useEffect(() => {
    draftDirtyRef.current = false;
    unlock();
    setRoster([]);
    setSelectedYouthIds([]);
    setSelections({});
    setSubmitStatus('idle');
    setStatusMessage('');
  }, [sessionId, unlock]);

  const rosterQuery = useQuery<SessionRosterMember[]>({
    queryKey: [...SESSION_QUERY_KEY, sessionId, 'roster'],
    queryFn: ({ signal }) => getSessionRoster(sessionId!, { signal }),
    enabled: sessionId !== undefined,
  });

  useEffect(() => {
    if (!rosterQuery.data || draftDirtyRef.current) return;

    setRoster(rosterQuery.data);
    setSelectedYouthIds(rosterQuery.data.map(member => member.youthId));
    setSelections(Object.fromEntries(
      rosterQuery.data.map(member => [member.youthId, member.status ?? '']),
    ));
  }, [rosterQuery.data, sessionId]);

  const youthQuery = useQuery<AttendanceYouth[]>({
    queryKey: [...SESSION_QUERY_KEY, 'attendance-youth'],
    queryFn: ({ signal }) => getAttendanceYouth({ signal }),
    enabled: isOpenRoster,
  });
  const rosterUnavailable = Boolean(rosterQuery.error && !rosterQuery.data);
  const youthUnavailable = isOpenRoster && Boolean(youthQuery.error);
  const attendanceLoading = rosterQuery.isLoading || (isOpenRoster && youthQuery.isLoading);
  const attendanceUnavailable = rosterUnavailable || youthUnavailable;
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

    draftDirtyRef.current = true;
    setSelectedYouthIds(current => current.includes(youthId)
      ? current.filter(id => id !== youthId)
      : [...current, youthId]);
  };

  /**
   * Changes a roster member's draft status while editing is available.
   * @param youthId - ID of the enrolled roster member being edited.
   * @param status - Attendance choice; an empty choice omits the member from the saved records.
   * @example Setting a member to 'absent' leaves the loaded roster record untouched.
   */
  const updateAttendanceStatus = (youthId: string, status: AttendanceStatus | '') => {
    if (controlsDisabled) return;

    draftDirtyRef.current = true;
    setSelections(current => ({ ...current, [youthId]: status }));
  };

  /**
   * Saves an eligible draft once, then awaits page reconciliation before showing success.
   * Failed writes unlock for retry; unchanged open rosters cannot submit.
   * @returns Resolves after saving and page reconciliation, or after recording a write failure.
   * @example An unchecked open roster saves [] only when it differs from saved attendance.
   */
  const submit = async () => {
    if (!session || submitDisabled || !tryLock()) return;

    const sessionName = session.theme || `${session.programName} session`;
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
    setStatusMessage(`Saving attendance for ${sessionName}...`);

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
      : `Attendance successfully saved for ${sessionName}.`);
    setSubmitStatus('success');
  };

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
    rosterError: rosterQuery.error
      ? getErrorMessage(rosterQuery.error, 'Could not load session roster')
      : null,
    rosterUnavailable,
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
