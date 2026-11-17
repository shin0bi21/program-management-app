import { useEffect, useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import PageContainer from '../../../common/components/PageContainer/PageContainer';
import Button from '../../../common/components/Button/Button';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { type PageMessageValue } from '../../../common/components/PageMessageOverlay/PageMessageOverlay';
import type { Program } from '../../../common/features/programs/types';
import { SESSION_TABLE_KEYS, type ProgramSession, type SessionRosterMember } from './types';
import SessionModal from './components/SessionModal/SessionModal';
import SessionAttendanceModal from './components/SessionAttendanceModal/SessionAttendanceModal';
import SessionAttendanceDashboardCard from './components/SessionDashboard/SessionAttendanceDashboardCard/SessionAttendanceDashboardCard';
import SessionNotesDashboardCard from './components/SessionDashboard/SessionNotesDashboardCard/SessionNotesDashboardCard';
import SessionAttachmentsDashboardCard from './components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard';
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
  const { table: tableControls, view, appliedFilters } = controls;

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

  // Attendance modal.
  const [attendanceTarget, setAttendanceTarget] = useState<{ session: ProgramSession; roster: SessionRosterMember[] } | null>(null);
  const closeSessionAttendanceModal = () => setAttendanceTarget(null);

  // Session editor with saved data or optional calendar context.
  const [sessionModalTarget, setSessionModalTarget] = useState<{
    session?: ProgramSession; initialProgramId?: string; initialDate?: string;
  } | null>(null);
  const isSessionModalOpen = sessionModalTarget !== null;
  const closeSessionModal = () => setSessionModalTarget(null);
  const openEditSessionModal = (session: ProgramSession) => setSessionModalTarget({ session });

  // Table configuration.
  const columns = useSessionTable({
    canWriteSessions,
    onEdit: openEditSessionModal,
    onDelete: actions.requestDelete,
  });

  // View initialization and presentation.
  const selectedSession = selection.selectedSession;

  const selectedProgram = programs.find(program => program.id === (selectedSession?.programId ?? selectedProgramId)) ?? null;
  const canAddSession = !referencesLoading && programs.length > 0;
  const dashboard = <>
    {canReadAttendance && <SessionAttendanceDashboardCard
      session={selectedSession}
      canWrite={canWriteAttendance}
      onManage={(session, roster) => setAttendanceTarget({ session, roster })}
    />}
    <SessionNotesDashboardCard
      queryKey={SESSION_QUERY_KEY}
      session={selectedSession}
      canWrite={canWriteSessions}
    />
    <SessionAttachmentsDashboardCard
      queryKey={SESSION_QUERY_KEY}
      session={selectedSession}
      canWrite={canWriteSessions}
    />
  </>;

  const table = <SessionTable
    queryKey={SESSION_TABLE_QUERY_KEY}
    columns={columns}
    hiddenColumnKeys={tableControls.hiddenColumns}
    filters={appliedFilters}
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
  const hasCycleBounds = Boolean(appliedFilters.dateRange) && !cyclesError;
  const calendar = !hasCycleBounds
    ? cycleState
    : <SessionCalendar
    key={JSON.stringify([appliedFilters, actions.calendarRevision])}
    programs={programs}
    selectedProgramId={selectedProgram?.id}
    onProgramSelect={selectProgram}
    filters={appliedFilters}
    selectedSessionId={selection.selectedSessionId}
    onSelectedSessionLoaded={selection.syncSelectedSession}
    onSessionSelect={selectSession}
    calendarCacheRef={actions.calendarCacheRef}
    pendingSessionIds={actions.pendingSessionIds}
    onSessionMove={canWriteSessions ? actions.moveSession : undefined}
    onSessionEdit={canWriteSessions ? openEditSessionModal : undefined}
    onSessionDelete={canWriteSessions ? actions.requestDelete : undefined}
    onAddSession={canWriteSessions ? (program, date) => setSessionModalTarget({ initialProgramId: program.id, initialDate: date }) : undefined}
    onMessageChange={setViewError}
  />;

  return (
    <>
      <PageContainer
        title="Sessions"
        className="sessions-page"
        data-view={view}
        ariaLabel={view === 'table' ? 'Programming sessions and overview' : 'Programming calendar and overview'}
        controls={controls}
        loadingSpinner
        actions={
          canWriteSessions ? (
            <Button
              onClick={() => setSessionModalTarget({ initialProgramId: selectedProgram?.id })}
              disabled={!canAddSession}
            >
              + Add
            </Button>
          ) : undefined
        }

        search={{
          label: 'Search sessions',
          placeholder: 'Search titles, descriptions, or program cycles',
        }}
        columns={columns}
        messages={[
          controls.error,
          actions.moveError,
          referencesError,
          cyclesError,
          viewError,
        ]}
        dashboard={dashboard}
        table={hasCycleBounds ? table : cycleState}
        calendar={calendar}
      />

      <SessionAttendanceModal
        session={attendanceTarget?.session ?? null}
        roster={attendanceTarget?.roster ?? []}
        onClose={closeSessionAttendanceModal}
        onSaved={actions.syncAttendance}
      />

      {isSessionModalOpen && <SessionModal
        key={sessionModalTarget?.session?.id ?? 'new'}
        programs={programs}
        sessionTypes={sessionTypes}
        session={sessionModalTarget?.session}
        initialProgramId={sessionModalTarget?.initialProgramId}
        initialDate={sessionModalTarget?.initialDate}
        onClose={closeSessionModal}
        onSaved={result => {
          if ('session' in result) {
            actions.syncUpdatedSession(result);
          } else {
            return actions.refreshCreatedSessions(result);
          }
        }}
      />}

      <ConfirmModal
        action={actions.confirmAction}
        onClose={actions.closeConfirmation}
      />
    </>
  );
}
