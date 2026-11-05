import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  getSessionRoster,
  getAttendanceYouth,
  setSessionAttendance,
  type SessionAttendanceResult,
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

export default function useSessionAttendanceModal({
  session,
  onSaved,
}: UseSessionAttendanceModalOptions) {
  const draftDirtyRef = useRef(false);
  const { tryLock, unlock } = useSubmitLock();
  const sessionId = session?.id;

  const [roster, setRoster] = useState<SessionRosterMember[]>([]);
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

  const youth = [...(youthQuery.data ?? [])];
  const youthIds = new Set(youth.map(profile => profile.id));
  // Keep saved attendees available even if the current youth lookup no longer includes them.
  for (const member of rosterQuery.data ?? []) {
    if (!youthIds.has(member.youthId)) {
      youth.push({ id: member.youthId, firstName: member.firstName, lastName: member.lastName });
    }
  }
  youth.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const toggleOpenAttendee = (youthId: string) => {
    if (!isOpenRoster || submissionComplete || attendanceLoading || rosterUnavailable || youthUnavailable) return;

    const profile = youth.find(candidate => candidate.id === youthId);
    if (!profile) return;

    draftDirtyRef.current = true;
    setRoster(current => {
      if (current.some(member => member.youthId === youthId)) {
        return current.filter(member => member.youthId !== youthId);
      }

      const savedMember = rosterQuery.data?.find(member => member.youthId === youthId);
      return [...current, {
        youthId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        status: 'present' as const,
        notes: savedMember?.notes ?? null,
      }].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    });
  };

  const updateAttendanceStatus = (youthId: string, status: AttendanceStatus | '') => {
    draftDirtyRef.current = true;
    setSelections(current => ({ ...current, [youthId]: status }));
  };

  const submit = async () => {
    if (!session || attendanceLoading || rosterUnavailable || youthUnavailable || !tryLock()) return;

    const sessionName = session.theme || `${session.programName} session`;
    const attendance = isOpenRoster
      ? roster.map(member => ({
          youthId: member.youthId,
          status: 'present' as const,
          notes: member.notes,
        }))
      : roster.flatMap(member => {
          const status = selections[member.youthId];
          return status ? [{ youthId: member.youthId, status, notes: member.notes }] : [];
        });

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
    selections,
    youth,
    isOpenRoster,
    attendanceLoading,
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
