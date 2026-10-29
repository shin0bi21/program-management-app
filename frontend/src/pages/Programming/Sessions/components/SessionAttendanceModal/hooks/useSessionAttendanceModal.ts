import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  getSessionRoster,
  searchAttendanceYouth,
  setSessionAttendance,
  type SessionAttendanceResult,
} from '../../../sessions.api';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';

const SESSION_QUERY_KEY = ['sessions'] as const;
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import type { AttendanceStatus } from '../../../../../../common/features/AttendanceStatusSelect/types';
import type { AttendanceYouth, CohortSession, SessionRosterMember } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';

interface UseSessionAttendanceModalOptions {
  session: CohortSession | null;
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
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
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
    setSearch('');
    setAppliedSearch('');
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
  }, [rosterQuery.data]);

  const applySearch = useCallback(() => setAppliedSearch(search.trim()), [search]);
  const clearSearch = useCallback(() => {
    setSearch('');
    setAppliedSearch('');
  }, []);

  const searchQuery = useQuery<AttendanceYouth[]>({
    queryKey: ['sessions', 'attendance-youth-search', appliedSearch],
    queryFn: ({ signal }) => searchAttendanceYouth(appliedSearch, { signal }),
    enabled: Boolean(isOpenRoster && appliedSearch.length >= 2),
  });

  const searchResults = useMemo(() => {
    const checkedInYouthIds = new Set(roster.map(member => member.youthId));
    return (searchQuery.data ?? []).filter(profile => !checkedInYouthIds.has(profile.id));
  }, [roster, searchQuery.data]);
  const rosterUnavailable = Boolean(rosterQuery.error && !rosterQuery.data);

  const addOpenAttendee = (
    profile: AttendanceYouth,
  ) => {
    draftDirtyRef.current = true;
    setRoster(current => current.some(member => member.youthId === profile.id)
      ? current
      : [...current, {
          youthId: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          status: 'present' as const,
          notes: null,
        }].sort((a, b) => (
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        )));
    setSearch('');
  };

  const removeOpenAttendee = (youthId: string) => {
    draftDirtyRef.current = true;
    setRoster(current => current.filter(member => member.youthId !== youthId));
  };

  const updateAttendanceStatus = (youthId: string, status: AttendanceStatus | '') => {
    draftDirtyRef.current = true;
    setSelections(current => ({ ...current, [youthId]: status }));
  };

  const submit = async () => {
    if (!session || rosterUnavailable || !tryLock()) return;

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
    search,
    appliedSearch,
    searchResults,
    isOpenRoster,
    rosterLoading: rosterQuery.isLoading,
    rosterError: rosterQuery.error
      ? getErrorMessage(rosterQuery.error, 'Could not load session roster')
      : null,
    rosterUnavailable,
    searching: searchQuery.isFetching,
    searchError: searchQuery.error
      ? getErrorMessage(searchQuery.error, 'Could not search youth profiles')
      : null,
    submitStatus,
    statusMessage: statusMessage || undefined,
    submissionComplete,
    setSearch,
    applySearch,
    clearSearch,
    addOpenAttendee,
    removeOpenAttendee,
    updateAttendanceStatus,
    submit,
  };
}
