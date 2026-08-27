import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/authContext';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { type ConfirmAction } from '../../../common/components/ConfirmModal/types';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageErrorOverlay, { type PageErrorItem } from '../../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import type { CellContext } from '@tanstack/react-table';
import type { TableColumnDef } from '../../../common/components/Table/Table.types';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import { deleteSession } from '../../../common/features/programming/api/sessions.api';
import { COHORT_QUERY_KEY, SESSION_QUERY_KEY } from '../../../common/features/programming/queryKeys';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import { YOUTH_QUERY_KEY } from '../../../common/features/youth/queryKeys';
import { SESSION_TABLE_KEYS, type CohortSession } from '../../../common/types/cohort';
import { formatShortDate } from '../../../common/utils/date';
import { removeInfiniteListRow } from '../../../query/infiniteListCache';
import GenerateSessionsModal from '../common/components/GenerateSessionsModal/GenerateSessionsModal';
import { useCohorts } from '../common/hooks/useCohorts';
import { useSessionTypes } from '../common/hooks/useSessionTypes';
import AttendanceModal from './components/AttendanceModal/AttendanceModal';
import EditSessionModal from './components/EditSessionModal/EditSessionModal';
import SessionDashboard from './components/SessionDashboard/SessionDashboard';
import SessionCalendar from './components/SessionCalendar/SessionCalendar';
import SessionTable from './components/SessionTable/SessionTable';
import SessionTypeBadge from './components/SessionTypeBadge/SessionTypeBadge';
import { useSessionControls } from './hooks/useSessionControls';
import './Sessions.css';

const timeFormatter = new Intl.DateTimeFormat('en-CA', {
  hour: 'numeric',
  minute: '2-digit',
});
const SESSION_TABLE_QUERY_KEY = [...SESSION_QUERY_KEY, 'table'] as const;
const SESSION_CALENDAR_QUERY_KEY = [...SESSION_QUERY_KEY, 'calendar'] as const;

export default function Sessions() {
  const [viewError, setViewError] = useState<PageErrorItem | null>(null);
  const [dashboardErrors, setDashboardErrors] = useState<PageErrorItem[]>([]);

  // Permissions and application services.
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions, role } = useAuth();
  const canWriteAttendance = permissions.includes('write:attendance');
  const canWriteSessions = permissions.includes('write:sessions');

  // Page data and preferences.
  const { programs, loading: programsLoading, error: programsError } = usePrograms({ assignedOnly: true });
  const { cohorts, loading: cohortsLoading, error: cohortsError, refresh: refreshCohorts } = useCohorts();
  const {
    sessionTypes,
    loading: sessionTypesLoading,
    error: sessionTypesError,
  } = useSessionTypes();

  const selectedSessionId = searchParams.get('session') ?? '';
  const clearSelectedSession = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const controls = useSessionControls({
    role, programs, programsLoading, programsError, cohorts, cohortsLoading, cohortsError,
    sessionTypes, sessionTypesLoading, sessionTypesError,
    onFiltersChanged: clearSelectedSession,
    tableKeys: SESSION_TABLE_KEYS,
  });
  const {
    search, appliedSearch, view, programIds: selectedProgramIds, cohortId,
    sessionTypeIds: selectedSessionTypeIds, statuses: statusFilters, ready: filtersReady,
    sorting, columnWidths, filterCategories, schedulableCohorts,
  } = controls;

  // Selection and actions.
  const [calendarSessions, setCalendarSessions] = useState<CohortSession[]>([]);
  const [selectedTableSession, setSelectedTableSession] = useState<CohortSession | null>(null);
  const selectSession = (session: Pick<CohortSession, 'id'>) => {
    const next = new URLSearchParams(searchParams);
    next.set('session', session.id);
    setSearchParams(next);
  };

  const refreshSessionQueries = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: SESSION_TABLE_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: SESSION_CALENDAR_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
  ]).then(() => undefined);

  // Attendance modal.
  const [attendanceTarget, setAttendanceTarget] = useState<CohortSession | null>(null);
  const closeAttendanceModal = () => setAttendanceTarget(null);

  // Generate sessions modal.
  const [addSessionsOpen, setAddSessionsOpen] = useState(false);
  const openAddSessionsModal = () => setAddSessionsOpen(true);
  const closeAddSessionsModal = () => setAddSessionsOpen(false);

  // Edit session modal.
  const [editTarget, setEditTarget] = useState<CohortSession | null>(null);
  const closeEditSessionModal = () => setEditTarget(null);

  // Confirmation modal.
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const requestSessionDeletion = useCallback(
    (session: CohortSession) => {
      setConfirmAction({
        title: 'Delete Session',
        message: `Delete the ${session.theme} session for the ${session.programName} program on ${formatShortDate(session.startsAt)}? This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmVariant: 'danger',
        successMessage: 'Session deleted',
        onConfirm: async () => {
          await deleteSession(session.id);
          removeInfiniteListRow(queryClient, SESSION_TABLE_QUERY_KEY, session.id);
          setCalendarSessions(current => current.filter(candidate => candidate.id !== session.id));
          if (selectedSessionId === session.id) {
            setSelectedTableSession(null);
            clearSelectedSession();
          }
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: SESSION_CALENDAR_QUERY_KEY }),
            queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
          ]);
        },
      });
    },
    [clearSelectedSession, queryClient, selectedSessionId],
  );
  const closeConfirmation = () => setConfirmAction(null);

  // Table configuration.
  const columns = useMemo<TableColumnDef<CohortSession>[]>(
    () => [
      { id: 'program', header: 'Program', accessorFn: session => session.programName },
      { id: 'cohort', header: 'Cohort', accessorFn: session => session.cohortName },
      { id: 'theme', header: 'Title / Theme', accessorFn: session => session.theme },
      { id: 'date', header: 'Date', size: 135, accessorFn: session => formatShortDate(session.startsAt) },
      {
        id: 'time',
        header: 'Time',
        size: 165,
        accessorFn: session =>
          `${timeFormatter.format(new Date(session.startsAt))} – ${timeFormatter.format(new Date(session.endsAt))}`,
      },
      {
        id: 'type',
        header: 'Type',
        size: 135,
        accessorFn: session => session.sessionTypeName,
        cell: ({ row: { original: session } }) => <SessionTypeBadge name={session.sessionTypeName} />,
      },
      {
        id: 'status',
        header: 'Status',
        size: 110,
        accessorFn: session => session.state,
        cell: ({ row: { original: session } }) => <span className={`session-state session-state--${session.state}`}>{session.state}</span>,
      },
      ...(canWriteAttendance || canWriteSessions
        ? [
            {
              id: 'actions',
              size: 40,
              enableResizing: false,
              enableHiding: false,
              header: '',

              cell: ({ row: { original: session } }: CellContext<CohortSession, unknown>) => (
                <ActionsMenu
                  ariaLabel={`More actions for ${session.theme}`}
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
                            onClick: () => requestSessionDeletion(session),
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
    [canWriteAttendance, canWriteSessions, requestSessionDeletion],
  );

  // Derived presentation.
  const selectedSession = view === 'calendar'
    ? calendarSessions.find(session => session.id === selectedSessionId) ?? null
    : selectedTableSession?.id === selectedSessionId ? selectedTableSession : null;

  return (
    <>
      <main className="page-container page-container--data">
        <div
          className={`sessions-page data-page${view === 'calendar' ? ' sessions-page--calendar' : ''}`}
        >
          <PageHeader
            title="Sessions"
            actions={
              canWriteSessions ? (
                <Button onClick={openAddSessionsModal} disabled={!schedulableCohorts.length}>
                  + Add
                </Button>
              ) : undefined
            }
            search={
              <SearchInput
                label="Search sessions"
                value={search}
                appliedValue={appliedSearch}
                onChange={(event) => controls.setSearch(event.target.value)}
                onApply={controls.applySearch}
                onClear={controls.clearSearch}
                placeholder="Search titles, themes, descriptions, or cohorts"
              />
            }
            filters={filtersReady ? (
              <FilterCard
                categories={filterCategories}
                values={{
                  program: selectedProgramIds,
                  cohort: cohortId ? [cohortId] : [],
                  status: statusFilters,
                  type: selectedSessionTypeIds,
                }}
                onApply={(category, selected) => controls.applyFilter(category, category === 'cohort' ? selected.slice(0, 1) : selected)}
                onClearAll={controls.clearFilters}
              />
            ) : undefined}
            view={filtersReady ? (
              <ViewMenu
                value={view}
                options={[
                  { value: 'calendar', label: 'Calendar' },
                  { value: 'table', label: 'Table' },
                ]}
                onChange={controls.setView}
              />
            ) : undefined}
            columns={filtersReady && view === 'table'
              ? <ColumnVisibilityMenu columns={columns} hiddenColumnKeys={controls.hiddenColumns} onHiddenColumnKeysChange={controls.setHiddenColumns} />
              : undefined}
          />
          <PageErrorOverlay errors={[
            controls.error,
            programsError,
            cohortsError,
            sessionTypesError,
            viewError,
            ...dashboardErrors,
          ]} />
          {!filtersReady ? (
            <p role="status">Loading saved filters…</p>
          ) : view === 'table' ? (
            <PageBody
              ariaLabel="Sessions and overview"
              table={
                <SessionTable
                  queryKey={SESSION_TABLE_QUERY_KEY}
                  columns={columns}
                  hiddenColumnKeys={controls.hiddenColumns}
                  filters={{
                    programIds: selectedProgramIds,
                    cohortId: cohortId || undefined,
                    sessionTypeIds: selectedSessionTypeIds,
                    statuses: statusFilters,
                    search: appliedSearch || undefined,
                  }}
                  sorting={sorting}
                  columnWidths={columnWidths}
                  selectedSessionId={selectedSessionId}
                  onSelectedSessionResolved={setSelectedTableSession}
                  onSessionSelect={selectSession}
                  onSortingChange={controls.setSorting}
                  onColumnWidthsChange={controls.setColumnWidths}
                  onErrorChange={setViewError}
                />
              }
              dashboard={
                <SessionDashboard
                  sessionQueryKey={SESSION_QUERY_KEY}
                  session={selectedSession}
                  canWriteAttendance={canWriteAttendance}
                  canWriteSessions={canWriteSessions}
                  onAddAttendance={setAttendanceTarget}
                  onErrorsChange={setDashboardErrors}
                />
              }
            />
          ) : (
            <PageBody
              ariaLabel="Sessions calendar and overview"
              calendar={
                <SessionCalendar
                  queryKey={SESSION_CALENDAR_QUERY_KEY}
                  selectedProgramIds={selectedProgramIds}
                  selectedCohortId={cohortId}
                  selectedSessionId={selectedSessionId}
                  selectedSessionTypeIds={selectedSessionTypeIds}
                  selectedStatuses={statusFilters}
                  search={appliedSearch}
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
                    ? session => requestSessionDeletion(session)
                    : undefined}
                  onErrorChange={setViewError}
                />
              }
              dashboard={
                <SessionDashboard
                  sessionQueryKey={SESSION_QUERY_KEY}
                  session={selectedSession}
                  canWriteAttendance={canWriteAttendance}
                  canWriteSessions={canWriteSessions}
                  onAddAttendance={setAttendanceTarget}
                  onErrorsChange={setDashboardErrors}
                />
              }
            />
          )}
        </div>
      </main>

      <AttendanceModal
        session={attendanceTarget}
        onClose={closeAttendanceModal}
        onSaved={() => Promise.all([
          refreshSessionQueries(),
          queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
        ]).then(() => undefined)}
      />

      <EditSessionModal
        session={editTarget}
        onClose={closeEditSessionModal}
        onUpdated={refreshSessionQueries}
      />

      <GenerateSessionsModal
        cohort={null}
        cohorts={schedulableCohorts}
        isOpen={addSessionsOpen}
        initialCohortId={cohortId || schedulableCohorts[0]?.id}
        onClose={closeAddSessionsModal}
        onSuccess={async () => {
          await Promise.all([refreshSessionQueries(), refreshCohorts()]);
        }}
      />

      <ConfirmModal
        action={confirmAction}
        onClose={closeConfirmation}
      />
    </>
  );
}
