import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import LoadingSpinner from '../../../common/components/LoadingSpinner/LoadingSpinner';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageErrorOverlay, { type PageErrorItem } from '../../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import type { Program } from '../../../common/features/programs/types';
import ProgramOverviewDashboardCard from './components/ProgramOverviewDashboardCard/ProgramOverviewDashboardCard';
import ManageRosterModal from '../Cohorts/components/ManageRosterModal/ManageRosterModal';
import YouthReportModal from '../../../common/features/YouthReportModal/YouthReportModal';
import type { ProgramCohort } from '../Cohorts/types';
import { SESSION_TABLE_KEYS, type CohortSession, type SessionListFilters } from './types';
import AddSessionModal from './components/AddSessionModal/AddSessionModal';
import SessionAttendanceModal from './components/SessionAttendanceModal/SessionAttendanceModal';
import EditSessionModal from './components/EditSessionModal/EditSessionModal';
import SessionDashboard from './components/SessionDashboard/SessionDashboard';
import SessionCalendar from './components/SessionCalendar/SessionCalendar';
import SessionTable from './components/SessionTable/SessionTable';
import useSessionTable from './components/SessionTable/hooks/useSessionTable';
import useSessionActions from './hooks/actions/useSessionActions';
import useSessionData from './hooks/data/useSessionData';
import { useCohorts } from './hooks/data/useCohorts';
import useSessionSelection from './hooks/selection/useSessionSelection';
import { useSessionControls } from './hooks/useSessionControls';
import './Sessions.css';

const SESSION_QUERY_KEY = ['sessions'] as const;
const SESSION_TABLE_QUERY_KEY = [...SESSION_QUERY_KEY, 'table'] as const;
const SESSION_CALENDAR_QUERY_KEY = [...SESSION_QUERY_KEY, 'calendar'] as const;

export default function Programming() {
  const [viewError, setViewError] = useState<PageErrorItem | null>(null);
  const [dashboardErrors, setDashboardErrors] = useState<PageErrorItem[]>([]);

  // Permissions and application services.
  const { permissions, role } = useAuth();
  const canWriteAttendance = permissions.includes('write:attendance');
  const canWriteSessions = permissions.includes('write:sessions');
  const canReadCohorts = permissions.includes('read:programs');
  const canManageRoster = permissions.includes('write:enrollments');
  const canViewYouthReport = canReadCohorts && permissions.includes('read:attendance') && permissions.includes('read:sessions');

  // Page data.
  const {
    programs, sessionTypes, referencesLoading, referencesError,
    cycles, cyclesLoading, cyclesError,
  } = useSessionData();
  const { cohorts, loading: cohortsLoading, error: cohortsError, refresh: refreshCohorts } = useCohorts(undefined, canReadCohorts);

  // Saved preferences and current view.
  const controls = useSessionControls({
    role, programs, programsLoading: referencesLoading, programsError: referencesError,
    cycles, cyclesLoading, cyclesError,
    sessionTypes, sessionTypesLoading: referencesLoading, sessionTypesError: referencesError,
    tableKeys: SESSION_TABLE_KEYS,
  });
  const { search, filters, table: tableControls, view, ready: filtersReady } = controls;
  const { programIds: selectedProgramIds, cycleIds, sessionTypeIds: selectedSessionTypeIds, statuses: statusFilters } = filters;

  // Filter configuration.
  const sessionFilters = useMemo<SessionListFilters>(() => ({
    dateRange: filters.dateRange,
    programIds: selectedProgramIds,
    cycleIds,
    sessionTypeIds: selectedSessionTypeIds,
    statuses: statusFilters,
    search: search.appliedValue || undefined,
  }), [filters.dateRange, search.appliedValue, cycleIds, selectedProgramIds, selectedSessionTypeIds, statusFilters]);

  // Selection and actions.
  const selection = useSessionSelection();
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  useEffect(() => {
    if (!referencesLoading && !referencesError && selectedProgramId
      && !programs.some(program => program.id === selectedProgramId)) setSelectedProgramId(null);
  }, [programs, referencesError, referencesLoading, selectedProgramId, setSelectedProgramId]);
  const selectProgram = (program: Program, source?: 'row' | 'item') => {
    if (source !== 'item') selection.showProgramDashboard();
    setSelectedProgramId(program.id);
  };
  const selectSession = (session: CohortSession) => {
    setSelectedProgramId(session.programId);
    selection.selectSession(session);
  };
  const actions = useSessionActions({ onSessionRemoved: selection.removeSelectedSession });
  const applyFilter = (category: string, selected: string[]) => {
    selection.clearSelectedSession();
    setSelectedProgramId(null);
    filters.apply(category, selected);
  };
  const clearFilters = () => {
    selection.clearSelectedSession();
    setSelectedProgramId(null);
    filters.clear();
  };

  // Roster and reporting workflows for the selected program and cycle.
  const [rosterTarget, setRosterTarget] = useState<ProgramCohort | null>(null);
  const [reportTarget, setReportTarget] = useState<ProgramCohort | null>(null);

  // Attendance modal.
  const [attendanceTarget, setAttendanceTarget] = useState<CohortSession | null>(null);
  const closeSessionAttendanceModal = () => setAttendanceTarget(null);

  // Single-session creation from the page or a calendar date.
  const [addSessionTarget, setAddSessionTarget] = useState<{ programId?: string; date?: string } | null>(null);
  const closeAddSessionModal = () => setAddSessionTarget(null);

  // Edit session modal.
  const [editTarget, setEditTarget] = useState<CohortSession | null>(null);
  const closeEditSessionModal = () => setEditTarget(null);

  // Table configuration.
  const columns = useSessionTable({
    programs,
    canWriteAttendance,
    canWriteSessions,
    onTakeAttendance: setAttendanceTarget,
    onEdit: setEditTarget,
    onDelete: actions.requestDelete,
  });

  // View initialization and presentation.
  const selectedSession = selection.getSelectedSession(view);

  const selectedProgram = programs.find(program => program.id === (selectedSession?.programId ?? selectedProgramId)) ?? null;
  const canAddSession = !referencesLoading && programs.length > 0;
  const programCohorts = cohorts.filter(cohort => cohort.programId === selectedProgram?.id
    && (!cycleIds.length || cycleIds.includes(cohort.cycleId)));
  const programDashboard = <ProgramOverviewDashboardCard
    program={selectedProgram}
    cohorts={programCohorts}
    loading={cohortsLoading}
    error={cohortsError}
    onRetry={() => { void refreshCohorts(); }}
    canManageRoster={canManageRoster}
    canViewYouthReport={canViewYouthReport}
    onManageRoster={setRosterTarget}
    onViewReport={setReportTarget}
  />;
  const dashboard = selection.dashboardMode === 'session' ? <SessionDashboard
    sessionQueryKey={SESSION_QUERY_KEY}
    session={selectedSession}
    canWriteAttendance={canWriteAttendance}
    canWriteSessions={canWriteSessions}
    onAddAttendance={setAttendanceTarget}
    onErrorsChange={setDashboardErrors}
  /> : programDashboard;

  const table = <SessionTable
    queryKey={SESSION_TABLE_QUERY_KEY}
    columns={columns}
    hiddenColumnKeys={tableControls.hiddenColumns}
    filters={sessionFilters}
    sorting={tableControls.sorting}
    columnWidths={tableControls.columnWidths}
    selectedSessionId={selection.selectedSessionId}
    onSelectedSessionResolved={selection.setSelectedTableSession}
    onSessionSelect={selectSession}
    onSortingChange={tableControls.setSorting}
    onColumnWidthsChange={tableControls.setColumnWidths}
    onErrorChange={setViewError}
  />;

  const cycleState = <p className="page-empty">{cyclesError ? 'Cycles unavailable.' : 'No cycles available.'}</p>;
  const hasCycleBounds = Boolean(filters.dateRange) && !cyclesError;
  const calendar = !hasCycleBounds
    ? cycleState
    : <SessionCalendar
    key={JSON.stringify([sessionFilters, actions.calendarRevision])}
    programs={programs}
    selectedProgramId={selectedProgram?.id}
    onProgramSelect={selectProgram}
    queryKey={SESSION_CALENDAR_QUERY_KEY}
    filters={sessionFilters}
    selectedSessionId={selection.selectedSessionId}
    onSessionsLoaded={selection.setCalendarSessions}
    onSessionSelect={session => {
      setSelectedProgramId(session.programId);
      selection.selectCalendarSession(session);
    }}
    pendingSessionIds={actions.pendingSessionIds}
    onSessionMove={canWriteSessions ? actions.moveSession : undefined}
    onSessionEdit={canWriteSessions ? setEditTarget : undefined}
    onSessionDelete={canWriteSessions ? actions.requestDelete : undefined}
    onAddSession={canWriteSessions ? (program, date) => setAddSessionTarget({ programId: program.id, date }) : undefined}
    onErrorChange={setViewError}
  />;
  const viewContent = view === 'table' ? { table: hasCycleBounds ? table : cycleState } : { calendar };

  return (
    <>
      <main className="page-container sessions-page" data-view={view}>
        <PageHeader
          title="Programming"
          actions={
            canWriteSessions ? (
              <Button onClick={() => setAddSessionTarget({ programId: selectedProgram?.id })} disabled={!canAddSession}>
                + Add Session
              </Button>
            ) : undefined
          }

          search={
            <SearchInput
              label="Search sessions"
              value={search.value}
              appliedValue={search.appliedValue}
              onChange={(event) => search.setValue(event.target.value)}
              onApply={search.apply}
              onClear={search.clear}
              placeholder="Search titles, themes, descriptions, or cohorts"
            />
          }

          filters={filtersReady ? (
            <FilterCard
              categories={filters.definitions}
              values={{
                program: selectedProgramIds,
                cycle: cycleIds,
                status: statusFilters,
                type: selectedSessionTypeIds,
              }}
              onApply={applyFilter}
              onClearAll={clearFilters}
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
            ? <ColumnVisibilityMenu columns={columns} hiddenColumnKeys={tableControls.hiddenColumns} onHiddenColumnKeysChange={tableControls.setHiddenColumns} />
            : undefined}
        />
        <PageErrorOverlay errors={[
          controls.error,
          actions.moveError,
          referencesError,
          cohortsError,
          cyclesError,
          viewError,
          ...dashboardErrors,
        ]} />

        {!filtersReady ? <p className="page-loading-status" role="status"><LoadingSpinner />Loading saved filters…</p> : <PageBody
          ariaLabel={view === 'table' ? 'Programming sessions and overview' : 'Programming calendar and overview'}
          dashboard={dashboard}
          {...viewContent}
        />}
      </main>

      <SessionAttendanceModal
        session={attendanceTarget}
        onClose={closeSessionAttendanceModal}
        onSaved={actions.refreshAttendance}
      />

      <EditSessionModal
        session={editTarget}
        timezone={programs.find(program => program.id === editTarget?.programId)?.timezone ?? 'America/Toronto'}
        onClose={closeEditSessionModal}
        onUpdated={actions.refreshSessionQueries}
      />

      {addSessionTarget && <AddSessionModal
        programs={programs}
        initialProgramId={addSessionTarget.programId}
        initialDate={addSessionTarget.date}
        onClose={closeAddSessionModal}
        onSaved={async () => {
          await Promise.all([actions.refreshSessionQueries(), refreshCohorts()]);
        }}
      />}

      {canReadCohorts && <ManageRosterModal
        cohort={rosterTarget}
        onClose={() => setRosterTarget(null)}
        onSuccess={async () => {
          await actions.refreshAttendance();
        }}
      />}
      {reportTarget && <YouthReportModal cohort={reportTarget} onClose={() => setReportTarget(null)} />}
      <ConfirmModal
        action={actions.confirmAction}
        onClose={actions.closeConfirmation}
      />
    </>
  );
}
