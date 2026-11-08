import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import PageContainer from '../../../common/components/PageContainer/PageContainer';
import Button from '../../../common/components/Button/Button';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { type PageMessageValue } from '../../../common/components/PageMessageOverlay/PageMessageOverlay';
import type { Program } from '../../../common/features/programs/types';
import { SESSION_TABLE_KEYS, type ProgramSession, type SessionListFilters } from './types';
import AddSessionModal from './components/AddSessionModal/AddSessionModal';
import SessionAttendanceModal from './components/SessionAttendanceModal/SessionAttendanceModal';
import EditSessionModal from './components/EditSessionModal/EditSessionModal';
import SessionDashboard from './components/SessionDashboard/SessionDashboard';
import SessionCalendar from './components/SessionCalendar/SessionCalendar';
import SessionTable from './components/SessionTable/SessionTable';
import useSessionTable from './components/SessionTable/hooks/useSessionTable';
import useSessionActions from './hooks/actions/useSessionActions';
import useSessionData from './hooks/data/useSessionData';
import useSessionSelection from './hooks/selection/useSessionSelection';
import { useSessionControls } from './hooks/useSessionControls';
import './Sessions.css';

const SESSION_QUERY_KEY = ['sessions'] as const;
const SESSION_TABLE_QUERY_KEY = [...SESSION_QUERY_KEY, 'table'] as const;

/**
 * Coordinates session controls, selection, dialogs, and collection views.
 * @example <Sessions /> // programming sessions route
 */
export default function Sessions() {
  const [viewError, setViewError] = useState<PageMessageValue>(null);
  const [dashboardErrors, setDashboardErrors] = useState<PageMessageValue[]>([]);

  // Permissions and application services.
  const { permissions, role } = useAuth();
  const canReadAttendance = permissions.includes('read:attendance');
  const canWriteAttendance = permissions.includes('write:attendance');
  const canWriteSessions = permissions.includes('write:sessions');

  // Page data.
  const {
    programs, sessionTypes, referencesLoading, referencesError,
    cycles, cyclesLoading, cyclesError,
  } = useSessionData();

  // Saved preferences and current view.
  const controls = useSessionControls({
    role, programs, programsLoading: referencesLoading, programsError: referencesError,
    cycles, cyclesLoading, cyclesError,
    sessionTypes, sessionTypesLoading: referencesLoading, sessionTypesError: referencesError,
    tableKeys: SESSION_TABLE_KEYS,
  });
  const { search, filters, table: tableControls, view } = controls;
  const { programIds: selectedProgramIds, cycleIds, sessionTypes: selectedSessionTypes, statuses: statusFilters } = filters.values;

  // Filter configuration.
  const sessionFilters = useMemo<SessionListFilters>(() => ({
    dateRange: filters.dateRange,
    programIds: selectedProgramIds,
    cycleIds,
    sessionTypes: selectedSessionTypes,
    statuses: statusFilters,
    search: search.appliedValue || undefined,
  }), [filters.dateRange, search.appliedValue, cycleIds, selectedProgramIds, selectedSessionTypes, statusFilters]);

  // Selection and actions.
  const selection = useSessionSelection();
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  useEffect(() => {
    if (!referencesLoading && !referencesError && selectedProgramId
      && !programs.some(program => program.id === selectedProgramId)) setSelectedProgramId(null);
  }, [programs, referencesError, referencesLoading, selectedProgramId, setSelectedProgramId]);
  const selectProgram = (program: Program, source?: 'row' | 'item') => {
    if (source !== 'item') selection.clearSelectedSession();
    setSelectedProgramId(program.id);
  };
  const selectSession = (session: ProgramSession) => {
    setSelectedProgramId(session.programId);
    selection.selectSession(session);
  };
  const actions = useSessionActions({ onSessionRemoved: selection.removeSelectedSession, onSessionSynced: selection.syncSelectedSession });
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

  // Attendance modal.
  const [attendanceTarget, setAttendanceTarget] = useState<ProgramSession | null>(null);
  const closeSessionAttendanceModal = () => setAttendanceTarget(null);

  // Single-session creation from the page or a calendar date.
  const [addSessionTarget, setAddSessionTarget] = useState<{ programId?: string; date?: string } | null>(null);
  const closeAddSessionModal = () => setAddSessionTarget(null);

  // Edit session modal.
  const [editTarget, setEditTarget] = useState<ProgramSession | null>(null);
  const closeEditSessionModal = () => setEditTarget(null);

  // Table configuration.
  const columns = useSessionTable({
    programs,
    canWriteSessions,
    onEdit: setEditTarget,
    onDelete: actions.requestDelete,
  });

  // View initialization and presentation.
  const selectedSession = selection.selectedSession;

  const selectedProgram = programs.find(program => program.id === (selectedSession?.programId ?? selectedProgramId)) ?? null;
  const canAddSession = !referencesLoading && programs.length > 0;
  const dashboard = <SessionDashboard
    sessionQueryKey={SESSION_QUERY_KEY}
    session={selectedSession}
    canReadAttendance={canReadAttendance}
    canWriteAttendance={canWriteAttendance}
    canWriteSessions={canWriteSessions}
    onAddAttendance={setAttendanceTarget}
    onErrorsChange={setDashboardErrors}
  />;

  const table = <SessionTable
    queryKey={SESSION_TABLE_QUERY_KEY}
    columns={columns}
    hiddenColumnKeys={tableControls.hiddenColumns}
    filters={sessionFilters}
    sorting={tableControls.sorting}
    columnWidths={tableControls.columnWidths}
    selectedSessionId={selection.selectedSessionId}
    onSelectedSessionLoaded={selection.syncSelectedSession}
    onSessionSelect={selectSession}
    onSortingChange={tableControls.setSorting}
    onColumnWidthsChange={tableControls.setColumnWidths}
    onMessageChange={setViewError}
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
    filters={sessionFilters}
    selectedSessionId={selection.selectedSessionId}
    onSelectedSessionLoaded={selection.syncSelectedSession}
    onSessionSelect={session => {
      setSelectedProgramId(session.programId);
      selection.selectSession(session);
    }}
    calendarCacheRef={actions.calendarCacheRef}
    pendingSessionIds={actions.pendingSessionIds}
    onSessionMove={canWriteSessions ? actions.moveSession : undefined}
    onSessionEdit={canWriteSessions ? setEditTarget : undefined}
    onSessionDelete={canWriteSessions ? actions.requestDelete : undefined}
    onAddSession={canWriteSessions ? (program, date) => setAddSessionTarget({ programId: program.id, date }) : undefined}
    onMessageChange={setViewError}
  />;

  return (
    <>
      <PageContainer
        title="Sessions"
        className="sessions-page"
        data-view={view}
        ariaLabel={view === 'table' ? 'Programming sessions and overview' : 'Programming calendar and overview'}
        controls={{ ...controls, filters: { ...filters, apply: applyFilter, clear: clearFilters } }}
        loadingSpinner
        actions={
          canWriteSessions ? (
            <Button onClick={() => setAddSessionTarget({ programId: selectedProgram?.id })} disabled={!canAddSession}>
              + Add
            </Button>
          ) : undefined
        }

        search={{
          label: 'Search sessions',
          placeholder: 'Search titles, themes, descriptions, or program cycles',
        }}
        columns={columns}
        messages={[
          controls.error,
          actions.moveError,
          referencesError,
          cyclesError,
          viewError,
          ...dashboardErrors,
        ]}
        dashboard={dashboard}
        table={hasCycleBounds ? table : cycleState}
        calendar={calendar}
      />

      <SessionAttendanceModal
        session={attendanceTarget}
        onClose={closeSessionAttendanceModal}
        onSaved={actions.syncAttendance}
      />

      <EditSessionModal
        session={editTarget}
        sessionTypes={sessionTypes}
        timezone={programs.find(program => program.id === editTarget?.programId)?.timezone ?? 'America/Toronto'}
        onClose={closeEditSessionModal}
        onUpdated={actions.syncUpdatedSession}
      />

      {addSessionTarget && <AddSessionModal
        programs={programs}
        sessionTypes={sessionTypes}
        initialProgramId={addSessionTarget.programId}
        initialDate={addSessionTarget.date}
        onClose={closeAddSessionModal}
        onSaved={actions.refreshCreatedSessions}
      />}

      <ConfirmModal
        action={actions.confirmAction}
        onClose={actions.closeConfirmation}
      />
    </>
  );
}
