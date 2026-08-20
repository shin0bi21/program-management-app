import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getSessionRoster,
  setSessionAttendance,
} from '../../../../../../common/features/programming/api/sessions.api';
import { SESSION_QUERY_KEY } from '../../../../../../common/features/programming/queryKeys';
import { getYouth } from '../../../../../../common/features/youth/youth.api';
import { YOUTH_QUERY_KEY } from '../../../../../../common/features/youth/queryKeys';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import type {
  AttendanceStatus,
  CohortSession,
  SessionRosterMember,
} from '../../../../../../common/types/cohort';
import type { YouthProfile } from '../../../../../../common/types/youth';
import { getErrorMessage } from '../../../../../../http/clientErrors';

interface UseAttendanceModalOptions {
  session: CohortSession | null;
  onSaved: () => void | Promise<void>;
}

export default function useAttendanceModal({
  session,
  onSaved,
}: UseAttendanceModalOptions) {
  const queryClient = useQueryClient();
  const draftDirtyRef = useRef(false);
  const { tryLock, unlock } = useSubmitLock();
  const sessionId = session?.id;

  const [roster, setRoster] = useState<SessionRosterMember[]>([]);
  const [selections, setSelections] = useState<Record<string, AttendanceStatus | ''>>({});
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [creatingYouth, setCreatingYouth] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const isOpenRoster = session?.rosterMode === 'open';
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  // A different session starts a fresh attendance draft and submission lifecycle.
  useEffect(() => {
    draftDirtyRef.current = false;
    unlock();
    setRoster([]);
    setSelections({});
    setSearch('');
    setDebouncedSearch('');
    setCreatingYouth(false);
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

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const searchQuery = useQuery<YouthProfile[]>({
    queryKey: [...YOUTH_QUERY_KEY, 'search', debouncedSearch],
    queryFn: ({ signal }) => getYouth(undefined, { search: debouncedSearch }, { signal }),
    enabled: Boolean(isOpenRoster && debouncedSearch.length >= 2),
  });

  const searchResults = useMemo(() => {
    const checkedInYouthIds = new Set(roster.map(member => member.youthId));
    return (searchQuery.data ?? []).filter(profile => !checkedInYouthIds.has(profile.id));
  }, [roster, searchQuery.data]);
  const rosterUnavailable = Boolean(rosterQuery.error && !rosterQuery.data);

  const addOpenAttendee = (
    profile: Pick<YouthProfile, 'id' | 'firstName' | 'lastName'>,
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

  const handleYouthCreated = (profile: YouthProfile) => {
    addOpenAttendee(profile);
    void queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY });
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

    try {
      await setSessionAttendance(session.id, attendance);
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not save attendance'));
      setSubmitStatus('error');
      unlock();
      return;
    }

    let refreshFailed = false;
    try {
      await onSaved();
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
    searchResults,
    creatingYouth,
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
    addOpenAttendee,
    removeOpenAttendee,
    updateAttendanceStatus,
    startCreatingYouth: () => setCreatingYouth(true),
    stopCreatingYouth: () => setCreatingYouth(false),
    handleYouthCreated,
    submit,
  };
}
