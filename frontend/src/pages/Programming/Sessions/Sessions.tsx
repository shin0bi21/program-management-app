import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/authContext';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import Modal from '../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import type { TableColumn } from '../../../common/components/Table/Table';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import { deleteSession } from '../../../common/features/programming/api/sessions.api';
import { COHORT_QUERY_KEY, SESSION_QUERY_KEY } from '../../../common/features/programming/queryKeys';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import { YOUTH_QUERY_KEY } from '../../../common/features/youth/queryKeys';
import type { CohortSession } from '../../../common/types/cohort';
import { formatShortDate } from '../../../common/utils/date';
import { removeInfiniteListRow } from '../../../query/infiniteListCache';
import GenerateSessionsModal from '../common/components/GenerateSessionsModal/GenerateSessionsModal';
import { useCohorts } from '../common/hooks/useCohorts';
import { useSessionTypes } from '../common/hooks/useSessionTypes';
import AttendanceModal from './components/AttendanceModal/AttendanceModal';
import EditSessionModal from './components/EditSessionModal/EditSessionModal';
import SessionDashboard from './components/SessionDashboard/SessionDashboard';
import SessionsCalendarView from './components/SessionsCalendarView/SessionsCalendarView';
import SessionListView from './components/SessionListView/SessionListView';
import SessionTypeBadge from './components/SessionTypeBadge/SessionTypeBadge';
import { useSessionControls } from './hooks/useSessionControls';
import './Sessions.css';

const timeFormatter = new Intl.DateTimeFormat('en-CA', {
  hour: 'numeric',
  minute: '2-digit',
});
const SESSION_COLUMN_KEYS = ['program', 'cohort', 'theme', 'date', 'time', 'type', 'status'] as const;
const SESSION_SORT_KEYS = ['program', 'cohort', 'theme', 'date', 'time', 'type', 'status'] as const;
const SESSION_LIST_QUERY_KEY = [...SESSION_QUERY_KEY, 'list'] as const;
const SESSION_CALENDAR_QUERY_KEY = [...SESSION_QUERY_KEY, 'calendar'] as const;

export default function Sessions() {
  // Application services and route state.
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions, role } = useAuth();

  // Shared options used by filters and session forms.
  const { programs, loading: programsLoading, error: programsError } = usePrograms({ assignedOnly: true });
  const { cohorts, loading: cohortsLoading, error: cohortsError, refresh: refreshCohorts } = useCohorts();
  const {
    sessionTypes,
    loading: sessionTypesLoading,
    error: sessionTypesError,
  } = useSessionTypes();

  // Page dialogs and selected records.
  const [attendanceTarget, setAttendanceTarget] = useState<CohortSession | null>(null);
  const [addSessionsOpen, setAddSessionsOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CohortSession | null>(null);
  const [calendarSessions, setCalendarSessions] = useState<CohortSession[]>([]);
  const [selectedListSession, setSelectedListSession] = useState<CohortSession | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });

  // URL selection and permission capabilities.
  const selectedSessionId = searchParams.get('session') ?? '';
  const canWriteAttendance = permissions.includes('write:attendance');
  const canWriteSessions = permissions.includes('write:sessions');
  const clearSelectedSession = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  // Persisted filters, sorting, and view controls.
  const controls = useSessionControls({
    role, programs, programsLoading, programsError, cohorts, cohortsLoading, cohortsError,
    sessionTypes, sessionTypesLoading, sessionTypesError,
    onFiltersChanged: clearSelectedSession,
    columnKeys: SESSION_COLUMN_KEYS,
    sortKeys: SESSION_SORT_KEYS,
  });
  const {
    search, debouncedSearch, view, programIds: selectedProgramIds, cohortId,
    sessionTypeIds: selectedSessionTypeIds, statuses: statusFilters, ready: filtersReady,
    sorting, columnWidths, filterCategories, schedulableCohorts,
  } = controls;

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
          removeInfiniteListRow(queryClient, SESSION_LIST_QUERY_KEY, session.id);
          setCalendarSessions(current => current.filter(candidate => candidate.id !== session.id));
          if (selectedSessionId === session.id) {
            setSelectedListSession(null);
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

  const selectSession = (session: Pick<CohortSession, 'id'>) => {
    const next = new URLSearchParams(searchParams);
    next.set('session', session.id);
    setSearchParams(next);
  };

  const columns = useMemo<TableColumn<CohortSession>[]>(
    () => [
      { key: 'program', sortKey: 'program', header: 'Program', render: (session) => session.programName },
      { key: 'cohort', sortKey: 'cohort', header: 'Cohort', render: (session) => session.cohortName },
      { key: 'theme', sortKey: 'theme', header: 'Title / Theme', render: (session) => session.theme },
      { key: 'date', sortKey: 'date', header: 'Date', width: 135, render: (session) => formatShortDate(session.startsAt) },
      {
        key: 'time',
        sortKey: 'time',
        header: 'Time',
        width: 165,
        render: (session) =>
          `${timeFormatter.format(new Date(session.startsAt))} – ${timeFormatter.format(new Date(session.endsAt))}`,
      },
      {
        key: 'type',
        sortKey: 'type',
        header: 'Type',
        width: 135,
        render: (session) => <SessionTypeBadge name={session.sessionTypeName} />,
      },
      {
        key: 'status',
        sortKey: 'status',
        header: 'Status',
        width: 110,
        render: (session) => <span className={`session-state session-state--${session.state}`}>{session.state}</span>,
      },
      ...(canWriteAttendance || canWriteSessions
        ? [
            {
              key: 'actions',
              width: 40,
              resizable: false,
              header: '',
              className: 'col-actions',
              render: (session: CohortSession) => (
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

  const selectedSession = view === 'calendar'
    ? calendarSessions.find(session => session.id === selectedSessionId) ?? null
    : selectedListSession?.id === selectedSessionId ? selectedListSession : null;

  const refreshSessionQueries = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: SESSION_LIST_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: SESSION_CALENDAR_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
  ]).then(() => undefined);

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
                <Button onClick={() => setAddSessionsOpen(true)} disabled={!schedulableCohorts.length}>
                  + Add
                </Button>
              ) : undefined
            }
            search={
              <SearchInput
                label="Search sessions"
                value={search}
                onChange={(event) => controls.setSearch(event.target.value)}
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
                  { value: 'list', label: 'List' },
                ]}
                onChange={controls.setView}
              />
            ) : undefined}
            columns={filtersReady && view === 'list'
              ? <ColumnVisibilityMenu columns={columns} hiddenColumnKeys={controls.hiddenColumns} onHiddenColumnKeysChange={controls.setHiddenColumns} />
              : undefined}
          />
          {controls.error && <p className="form-error" role="alert">{controls.error}</p>}
          {programsError && <p className="form-error" role="alert">{programsError}</p>}
          {cohortsError && <p className="form-error" role="alert">{cohortsError}</p>}
          {sessionTypesError && <p className="form-error" role="alert">{sessionTypesError}</p>}
          {!filtersReady ? (
            <p role="status">Loading saved filters…</p>
          ) : view === 'list' ? (
            <PageBody
              ariaLabel="Sessions and overview"
              table={
                <SessionListView
                  queryKey={SESSION_LIST_QUERY_KEY}
                  columns={columns}
                  hiddenColumnKeys={controls.hiddenColumns}
                  filters={{
                    programIds: selectedProgramIds,
                    cohortId: cohortId || undefined,
                    sessionTypeIds: selectedSessionTypeIds,
                    statuses: statusFilters,
                    search: debouncedSearch || undefined,
                  }}
                  sorting={sorting}
                  columnWidths={columnWidths}
                  selectedSessionId={selectedSessionId}
                  onSelectedSessionResolved={setSelectedListSession}
                  onSessionSelect={selectSession}
                  onSortingChange={controls.setSorting}
                  onColumnWidthsChange={controls.setColumnWidths}
                />
              }
              dashboard={
                <SessionDashboard
                  sessionQueryKey={SESSION_QUERY_KEY}
                  session={selectedSession}
                  canWriteAttendance={canWriteAttendance}
                  canWriteSessions={canWriteSessions}
                  onAddAttendance={setAttendanceTarget}
                />
              }
            />
          ) : (
            <PageBody
              ariaLabel="Sessions calendar and overview"
              calendar={
                <SessionsCalendarView
                  queryKey={SESSION_CALENDAR_QUERY_KEY}
                  selectedProgramIds={selectedProgramIds}
                  selectedCohortId={cohortId}
                  selectedSessionId={selectedSessionId}
                  selectedSessionTypeIds={selectedSessionTypeIds}
                  selectedStatuses={statusFilters}
                  search={debouncedSearch}
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
                />
              }
              dashboard={
                <SessionDashboard
                  sessionQueryKey={SESSION_QUERY_KEY}
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
            onSaved={() => Promise.all([
              refreshSessionQueries(),
              queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
            ]).then(() => undefined)}
          />
          <EditSessionModal session={editTarget} onClose={() => setEditTarget(null)} onUpdated={refreshSessionQueries} />
          <Modal
            isOpen={confirmAction !== null}
            onClose={() => setConfirmAction(null)}
            title={confirmAction?.title ?? ''}
            status={confirmModal.status}
            statusMessage={confirmModal.statusMessage}
            footer={confirmModal.footer}
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
              await Promise.all([refreshSessionQueries(), refreshCohorts()]);
            }}
          />
        </div>
      </main>
    </>
  );
}
