import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import FilterCard, { type FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import Header from '../../../common/components/Header/Header';
import Modal from '../../../common/components/Modal/Modal';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../../common/components/Table/Table';
import TableDetailLayout from '../../../common/components/TableDetailLayout/TableDetailLayout';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import { deleteSession } from '../../../common/api/cohorts.api';
import { useAuth } from '../../../common/context/AuthContext';
import { usePrograms } from '../../../common/hooks/usePrograms';
import { useConfirmModal, type ConfirmAction } from '../../../common/hooks/useConfirmModal';
import useUserPreference from '../../../common/hooks/useUserPreference';
import type { CohortSession, SessionSortKey } from '../../../common/types/cohort';
import type { ListSort } from '../../../common/types/pagination';
import { formatShortDate } from '../../../common/utils/date';
import GenerateSessionsModal from '../common/components/GenerateSessionsModal/GenerateSessionsModal';
import { useCohorts } from '../common/hooks/useCohorts';
import { useSessionTypes } from '../common/hooks/useSessionTypes';
import { getSingleActiveCohort, getSingleAssignedProgram } from '../common/utils/staffProgrammingDefaults';
import AttendanceModal from './components/AttendanceModal';
import EditSessionModal from './components/EditSessionModal/EditSessionModal';
import SessionOverview from './components/SessionOverview/SessionOverview';
import SessionsCalendarView from './components/SessionsCalendarView/SessionsCalendarView';
import { useSessions } from './hooks/useSessions';
import { sessionTypeModifier } from './utils/sessionType';
import './Sessions.css';

const timeFormatter = new Intl.DateTimeFormat('en-CA', {
  hour: 'numeric',
  minute: '2-digit',
});
type StatusFilter = 'upcoming' | 'completed';
type SessionsView = 'list' | 'calendar';

export default function Sessions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions, role } = useAuth();
  const { programs, loading: programsLoading } = usePrograms({ assignedOnly: true });
  const { cohorts, loading: cohortsLoading, refresh: refreshCohorts } = useCohorts();
  const sessionTypes = useSessionTypes();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [attendanceTarget, setAttendanceTarget] = useState<CohortSession | null>(null);
  const [addSessionsOpen, setAddSessionsOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CohortSession | null>(null);
  const [calendarSessions, setCalendarSessions] = useState<CohortSession[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const [view, setViewState] = useState<SessionsView>('calendar');
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [cohortId, setCohortId] = useState('');
  const [selectedSessionTypeIds, setSelectedSessionTypeIds] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([]);
  const [filtersReady, setFiltersReady] = useState(false);
  const [sorting, setSorting] = useState<ListSort<SessionSortKey>>({ key: 'date', direction: 'desc' });
  const selectedSessionId = searchParams.get('session') ?? '';
  const { preference, loading: preferenceLoading, error: preferenceError, save } = useUserPreference('session-filters');
  const canWriteAttendance = permissions.includes('write:attendance');
  const canWriteSessions = permissions.includes('write:sessions');

  const requestSessionDeletion = useCallback(
    (session: CohortSession, onDeleted: () => void | Promise<void>) => {
      setConfirmAction({
        title: 'Delete Session',
        message: `Delete the ${session.theme || session.sessionTypeName} session for the ${session.programName} program on ${formatShortDate(session.startsAt)}? This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmVariant: 'danger',
        successMessage: 'Session deleted',
        onConfirm: async () => {
          await deleteSession(session.id);
          await onDeleted();
        },
      });
    },
    [],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const legacyKeys = ['view', 'program', 'cohort', 'status', 'type'];
    if (!legacyKeys.some(key => searchParams.has(key))) return;
    const next = new URLSearchParams(searchParams);
    legacyKeys.forEach(key => next.delete(key));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (filtersReady || preferenceLoading || programsLoading || cohortsLoading || role === null) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    if (preference) {
      const programIds = preference.programIds.filter(id => availableProgramIds.has(id));
      setViewState(preference.view);
      setSelectedProgramIds(programIds);
      setCohortId(cohorts.some(cohort => cohort.id === preference.cohortId) ? preference.cohortId ?? '' : '');
      setSelectedSessionTypeIds(preference.sessionTypeIds);
      setStatusFilters(preference.statuses);
      setSorting(preference.sorting ?? { key: 'date', direction: 'desc' });
    } else {
      const assignedProgram = getSingleAssignedProgram(role, programs);
      setSelectedProgramIds(assignedProgram ? [assignedProgram.id] : []);
      setCohortId(assignedProgram ? getSingleActiveCohort(cohorts, assignedProgram.id)?.id ?? '' : '');
    }
    setFiltersReady(true);
  }, [cohorts, cohortsLoading, filtersReady, preference, preferenceLoading, programs, programsLoading, role]);

  const {
    sessions,
    loading,
    error,
    refresh: refreshSessions,
    hasNextPage,
    loadingNextPage,
    loadNextPage,
  } = useSessions(
    {
      programIds: selectedProgramIds,
      cohortId: cohortId || undefined,
      sessionTypeIds: selectedSessionTypeIds,
      statuses: statusFilters,
      search: debouncedSearch || undefined,
    },
    sorting,
    filtersReady && view === 'list',
  );

  const filteredCohorts = useMemo(
    () =>
      selectedProgramIds.length ? cohorts.filter((cohort) => selectedProgramIds.includes(cohort.programId)) : cohorts,
    [cohorts, selectedProgramIds],
  );
  const schedulableCohorts = useMemo(
    () => filteredCohorts.filter((cohort) => cohort.state !== 'completed'),
    [filteredCohorts],
  );

  const filterCategories = useMemo<FilterCardCategory[]>(
    () => [
      {
        id: 'program',
        label: 'Program',
        options: programs.map((program) => ({ value: program.id, label: program.name })),
      },
      {
        id: 'cohort',
        label: 'Cohort',
        selectionMode: 'single',
        options: filteredCohorts.map((cohort) => ({
          value: cohort.id,
          label: `${cohort.programName} · ${cohort.name}`,
        })),
      },
      {
        id: 'type',
        label: 'Type',
        options: sessionTypes.map((type) => ({ value: type.id, label: type.name })),
      },
      {
        id: 'status',
        label: 'Status',
        options: [
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'completed', label: 'Completed' },
        ],
      },
    ],
    [filteredCohorts, programs, sessionTypes],
  );

  const setFilter = (key: string, values: string[]) => {
    const nextProgramIds = key === 'program' ? values : selectedProgramIds;
    const nextCohortId = key === 'program' ? '' : key === 'cohort' ? values[0] ?? '' : cohortId;
    const nextSessionTypeIds = key === 'type' ? values : selectedSessionTypeIds;
    const nextStatuses = key === 'status' ? values as StatusFilter[] : statusFilters;
    setSelectedProgramIds(nextProgramIds);
    setCohortId(nextCohortId);
    setSelectedSessionTypeIds(nextSessionTypeIds);
    setStatusFilters(nextStatuses);
    void save({
      view,
      programIds: nextProgramIds,
      cohortId: nextCohortId || null,
      sessionTypeIds: nextSessionTypeIds,
      statuses: nextStatuses,
      sorting,
    });
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    setSearchParams(next);
  };

  const setView = (nextView: SessionsView) => {
    setViewState(nextView);
    void save({
      view: nextView,
      programIds: selectedProgramIds,
      cohortId: cohortId || null,
      sessionTypeIds: selectedSessionTypeIds,
      statuses: statusFilters,
      sorting,
    });
  };

  const clearFilters = () => {
    setSelectedProgramIds([]);
    setCohortId('');
    setSelectedSessionTypeIds([]);
    setStatusFilters([]);
    void save({ view, programIds: [], cohortId: null, sessionTypeIds: [], statuses: [], sorting });
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    setSearchParams(next);
  };

  const selectSession = (session: Pick<CohortSession, 'id'>) => {
    const next = new URLSearchParams(searchParams);
    next.set('session', session.id);
    setSearchParams(next);
  };

  const columns = useMemo<TableColumn<CohortSession>[]>(
    () => [
      { key: 'program', sortKey: 'program', header: 'Program', render: (session) => session.programName },
      { key: 'cohort', sortKey: 'cohort', header: 'Cohort', render: (session) => session.cohortName },
      { key: 'theme', sortKey: 'theme', header: 'Theme', render: (session) => session.theme || '—' },
      { key: 'date', sortKey: 'date', header: 'Date', width: '135px', render: (session) => formatShortDate(session.startsAt) },
      {
        key: 'time',
        sortKey: 'time',
        header: 'Time',
        width: '165px',
        render: (session) =>
          `${timeFormatter.format(new Date(session.startsAt))} – ${timeFormatter.format(new Date(session.endsAt))}`,
      },
      {
        key: 'type',
        sortKey: 'type',
        header: 'Type',
        width: '135px',
        render: (session) => (
          <span className={`session-type session-type--${sessionTypeModifier(session.sessionTypeName)}`}>
            {session.sessionTypeName}
          </span>
        ),
      },
      {
        key: 'status',
        sortKey: 'status',
        header: 'Status',
        width: '110px',
        render: (session) => <span className={`session-state session-state--${session.state}`}>{session.state}</span>,
      },
      ...(canWriteAttendance || canWriteSessions
        ? [
            {
              key: 'actions',
              header: '',
              className: 'col-actions',
              render: (session: CohortSession) => (
                <ActionsMenu
                  ariaLabel={`More actions for ${session.theme || `${session.programName} session`}`}
                  items={[
                    ...(canWriteAttendance
                      ? [
                          {
                            id: 'attendance',
                            label: 'Take Attendance',
                            onClick: () => setAttendanceTarget(session),
                          },
                        ]
                      : []),
                    ...(canWriteSessions
                      ? [
                          { id: 'edit', label: 'Edit Session', onClick: () => setEditTarget(session) },
                          {
                            id: 'delete',
                            label: 'Delete Session',
                            variant: 'danger' as const,
                            onClick: () => requestSessionDeletion(session, refreshSessions),
                          },
                        ]
                      : []),
                  ]}
                />
              ),
            },
          ]
        : []),
    ],
    [canWriteAttendance, canWriteSessions, refreshSessions, requestSessionDeletion],
  );

  const activeSessions = view === 'calendar' ? calendarSessions : sessions;
  const selectedSession = useMemo(
    () => activeSessions.find((session) => session.id === selectedSessionId) ?? null,
    [activeSessions, selectedSessionId],
  );

  const refreshActiveView = async () => {
    if (view === 'calendar') {
      setCalendarRefreshToken((current) => current + 1);
      return;
    }
    await refreshSessions();
  };

  return (
    <>
      <Header />
      <main className="page-container page-container--data">
        <div
          className={`sessions-page data-detail-page-content${view === 'calendar' ? ' sessions-page--calendar' : ''}`}
        >
          <PageHeader
            title="Sessions"
            actions={
              canWriteSessions ? (
                <Button onClick={() => setAddSessionsOpen(true)} disabled={!schedulableCohorts.length}>
                  + Add
                </Button>
              ) : undefined
            }
            search={
              <SearchInput
                label="Search sessions"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search themes, descriptions, or cohorts"
              />
            }
            filters={
              <FilterCard
                categories={filterCategories}
                values={{
                  program: selectedProgramIds,
                  cohort: cohortId ? [cohortId] : [],
                  status: statusFilters,
                  type: selectedSessionTypeIds,
                }}
                onApply={(category, selected) =>
                  setFilter(category, category === 'cohort' ? selected.slice(0, 1) : selected)
                }
                onClearAll={clearFilters}
              />
            }
            view={(
              <ViewMenu
                value={view}
                options={[
                  { value: 'calendar', label: 'Calendar' },
                  { value: 'list', label: 'List' },
                ]}
                onChange={setView}
              />
            )}
          />
          {preferenceError && <p role="alert">{preferenceError}</p>}
          {!filtersReady ? (
            <p role="status">Loading saved filters…</p>
          ) : view === 'list' ? (
            <TableDetailLayout
              ariaLabel="Sessions and overview"
              table={
                <Table
                  ariaLabel="Sessions"
                  columns={columns}
                  data={sessions}
                  loading={loading}
                  error={error ?? undefined}
                  keyExtractor={(session) => session.id}
                  selectedKey={selectedSessionId || null}
                  scrollToSelected={Boolean(selectedSessionId)}
                  onRowSelect={selectSession}
                  sorting={sorting}
                  onSortingChange={next => { const value = next as ListSort<SessionSortKey>; setSorting(value); void save({ view, programIds: selectedProgramIds, cohortId: cohortId || null, sessionTypeIds: selectedSessionTypeIds, statuses: statusFilters, sorting: value }); }}
                  hasNextPage={hasNextPage}
                  loadingNextPage={loadingNextPage}
                  onLoadNextPage={loadNextPage}
                  emptyMessage={
                    search ||
                    selectedProgramIds.length ||
                    cohortId ||
                    selectedSessionTypeIds.length ||
                    statusFilters.length
                      ? 'No sessions match your search and filters'
                      : 'No sessions yet'
                  }
                />
              }
              details={
                <SessionOverview
                  session={selectedSession}
                  canWriteAttendance={canWriteAttendance}
                  canWriteSessions={canWriteSessions}
                  onAddAttendance={setAttendanceTarget}
                />
              }
            />
          ) : (
            <TableDetailLayout
              ariaLabel="Sessions calendar and overview"
              table={
                <SessionsCalendarView
                  selectedProgramIds={selectedProgramIds}
                  selectedCohortId={cohortId}
                  selectedSessionId={selectedSessionId}
                  selectedSessionTypeIds={selectedSessionTypeIds}
                  selectedStatuses={statusFilters}
                  search={debouncedSearch}
                  refreshToken={calendarRefreshToken}
                  onSessionsLoaded={setCalendarSessions}
                  onSessionSelect={(session) => {
                    setCalendarSessions((current) =>
                      current.some((candidate) => candidate.id === session.id)
                        ? current
                        : [...current, session],
                    );
                    selectSession(session);
                  }}
                  onSessionEdit={canWriteSessions ? setEditTarget : undefined}
                  onSessionDelete={canWriteSessions
                    ? session => requestSessionDeletion(
                        session,
                        () => setCalendarRefreshToken(current => current + 1),
                      )
                    : undefined}
                />
              }
              details={
                <SessionOverview
                  session={selectedSession}
                  canWriteAttendance={canWriteAttendance}
                  canWriteSessions={canWriteSessions}
                  onAddAttendance={setAttendanceTarget}
                />
              }
            />
          )}
          <AttendanceModal
            session={attendanceTarget}
            onClose={() => setAttendanceTarget(null)}
            onSaved={refreshActiveView}
          />
          <EditSessionModal session={editTarget} onClose={() => setEditTarget(null)} onUpdated={refreshActiveView} />
          <Modal
            isOpen={confirmAction !== null}
            onClose={() => setConfirmAction(null)}
            title={confirmAction?.title ?? ''}
            status={confirmModal.status}
            statusMessage={confirmModal.statusMessage}
            footer={confirmModal.footer}
            disableClose={confirmModal.disableClose}
            successDelay={confirmModal.successDelay}
          >
            {confirmAction && <p>{confirmAction.message}</p>}
          </Modal>
          <GenerateSessionsModal
            cohort={null}
            cohorts={schedulableCohorts}
            isOpen={addSessionsOpen}
            initialCohortId={cohortId || schedulableCohorts[0]?.id}
            onClose={() => setAddSessionsOpen(false)}
            onSuccess={async () => {
              await Promise.all([refreshActiveView(), refreshCohorts()]);
            }}
          />
        </div>
      </main>
    </>
  );
}
