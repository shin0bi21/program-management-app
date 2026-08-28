import { useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageErrorOverlay, { type PageErrorItem } from '../../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import { SESSION_QUERY_KEY } from '../../../common/features/programming/queryKeys';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import { SESSION_TABLE_KEYS, type CohortSession } from '../../../common/types/cohort';
import GenerateSessionsModal from '../common/components/GenerateSessionsModal/GenerateSessionsModal';
import { useCohorts } from '../common/hooks/useCohorts';
import { useSessionTypes } from '../common/hooks/useSessionTypes';
import AttendanceModal from './components/AttendanceModal/AttendanceModal';
import EditSessionModal from './components/EditSessionModal/EditSessionModal';
import SessionDashboard from './components/SessionDashboard/SessionDashboard';
import SessionCalendar from './components/SessionCalendar/SessionCalendar';
import SessionTable from './components/SessionTable/SessionTable';
import useSessionTable from './components/SessionTable/hooks/useSessionTable';
import useSessionActions from './hooks/actions/useSessionActions';
import useSessionSelection from './hooks/selection/useSessionSelection';
import { useSessionControls } from './hooks/useSessionControls';
import './Sessions.css';

const SESSION_TABLE_QUERY_KEY = [...SESSION_QUERY_KEY, 'table'] as const;
const SESSION_CALENDAR_QUERY_KEY = [...SESSION_QUERY_KEY, 'calendar'] as const;

export default function Sessions() {
  const [viewError, setViewError] = useState<PageErrorItem | null>(null);
  const [dashboardErrors, setDashboardErrors] = useState<PageErrorItem[]>([]);

  // Permissions and application services.
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

  const selection = useSessionSelection();

  const controls = useSessionControls({
    role, programs, programsLoading, programsError, cohorts, cohortsLoading, cohortsError,
    sessionTypes, sessionTypesLoading, sessionTypesError,
    onFiltersChanged: selection.clearSelectedSession,
    tableKeys: SESSION_TABLE_KEYS,
  });
  const {
    search, appliedSearch, view, programIds: selectedProgramIds, cohortId,
    sessionTypeIds: selectedSessionTypeIds, statuses: statusFilters, ready: filtersReady,
    sorting, columnWidths, filterCategories, schedulableCohorts,
  } = controls;

  // Selection and actions.
  const actions = useSessionActions({ onSessionRemoved: selection.removeSelectedSession });

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

  // Table configuration.
  const columns = useSessionTable({
    canWriteAttendance,
    canWriteSessions,
    onTakeAttendance: setAttendanceTarget,
    onEdit: setEditTarget,
    onDelete: actions.requestDelete,
  });

  // View initialization and presentation.
  const selectedSession = selection.getSelectedSession(view);
  const dashboard = <SessionDashboard
    sessionQueryKey={SESSION_QUERY_KEY}
    session={selectedSession}
    canWriteAttendance={canWriteAttendance}
    canWriteSessions={canWriteSessions}
    onAddAttendance={setAttendanceTarget}
    onErrorsChange={setDashboardErrors}
  />;
  const table = <SessionTable
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
    selectedSessionId={selection.selectedSessionId}
    onSelectedSessionResolved={selection.setSelectedTableSession}
    onSessionSelect={selection.selectSession}
    onSortingChange={controls.setSorting}
    onColumnWidthsChange={controls.setColumnWidths}
    onErrorChange={setViewError}
  />;
  const calendar = <SessionCalendar
    queryKey={SESSION_CALENDAR_QUERY_KEY}
    selectedProgramIds={selectedProgramIds}
    selectedCohortId={cohortId}
    selectedSessionId={selection.selectedSessionId}
    selectedSessionTypeIds={selectedSessionTypeIds}
    selectedStatuses={statusFilters}
    search={appliedSearch}
    onSessionsLoaded={selection.setCalendarSessions}
    onSessionSelect={selection.selectCalendarSession}
    onSessionEdit={canWriteSessions ? setEditTarget : undefined}
    onSessionDelete={canWriteSessions ? actions.requestDelete : undefined}
    onErrorChange={setViewError}
  />;
  const viewContent = view === 'table' ? { table } : { calendar };

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
          {!filtersReady ? <p role="status">Loading saved filters…</p> : <PageBody
            ariaLabel={view === 'table' ? 'Sessions and overview' : 'Sessions calendar and overview'}
            dashboard={dashboard}
            {...viewContent}
          />}
        </div>
      </main>

      <AttendanceModal
        session={attendanceTarget}
        onClose={closeAttendanceModal}
        onSaved={actions.refreshAttendance}
      />

      <EditSessionModal
        session={editTarget}
        onClose={closeEditSessionModal}
        onUpdated={actions.refreshSessionQueries}
      />

      <GenerateSessionsModal
        cohort={null}
        cohorts={schedulableCohorts}
        isOpen={addSessionsOpen}
        initialCohortId={cohortId || schedulableCohorts[0]?.id}
        onClose={closeAddSessionsModal}
        onSuccess={async () => {
          await Promise.all([actions.refreshSessionQueries(), refreshCohorts()]);
        }}
      />

      <ConfirmModal
        action={actions.confirmAction}
        onClose={actions.closeConfirmation}
      />
    </>
  );
}
