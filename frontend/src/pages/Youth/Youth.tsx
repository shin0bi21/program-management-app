import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../../auth/authContext';
import PageContainer from '../../common/components/PageContainer/PageContainer';
import Button from '../../common/components/Button/Button';
import { type PageMessageValue } from '../../common/components/PageMessageOverlay/PageMessageOverlay';
import YouthReportModal from '../../common/features/YouthReportModal/YouthReportModal';
import SchoolModal from '../../common/features/SchoolModal/SchoolModal';
import useSchoolModal from '../../common/features/SchoolModal/hooks/useSchoolModal';
import YouthModal from './components/YouthModal/YouthModal';
import { YOUTH_TABLE_KEYS, type YouthFilters } from './types';
import ProfileNoteDialogs from './components/ProfileNotes/ProfileNoteDialogs';
import useProfileNotes from './components/ProfileNotes/useProfileNotes';
import YouthAttendanceModal from './components/YouthAttendanceModal/YouthAttendanceModal';
import YouthDashboard from './components/YouthDashboard/YouthDashboard';
import YouthTable from './components/YouthTable/YouthTable';
import useYouthTable from './components/YouthTable/hooks/useYouthTable';
import { useYouthActions } from './hooks/actions/useYouthActions';
import { useYouthSelection } from './hooks/selection/useYouthSelection';
import { useYouthControls } from './hooks/controls/useYouthControls';
import useYouthData from './hooks/data/useYouthData';
import type { YouthProfile } from './types';
import './Youth.css';

export default function Youth() {
  // Page-local errors.
  const [viewError, setViewError] = useState<PageMessageValue>(null);

  // Permissions and services.
  const { permissions, role } = useAuth();
  const canWrite = permissions.includes('write:youth_profiles');
  const canManageAttendance = permissions.includes('read:attendance')
    && permissions.includes('write:attendance')
    && permissions.includes('read:sessions');
  const canViewAttendanceReport = permissions.includes('read:programs')
    && permissions.includes('read:attendance')
    && permissions.includes('read:sessions');

  // Page data and preferences.
  const { programs, programsLoading, programsError, cycles, cyclesLoading, cyclesError } = useYouthData(role === 'staff');
  const controls = useYouthControls({
    role,
    programs,
    programsLoading,
    programsError,
    cycles,
    cyclesLoading,
    cyclesError,
    tableKeys: YOUTH_TABLE_KEYS,
  });
  const { search, filters, table, ready: controlsReady, error: preferencesError } = controls;

  // Filter configuration.
  const youthFilters = useMemo<YouthFilters | null>(() => controlsReady ? {
    search: search.appliedValue,
    programIds: filters.values.programIds,
    cycleIds: filters.values.cycleIds,
  } : null, [search.appliedValue, controlsReady, filters.values.programIds, filters.values.cycleIds]);

  // Selection and selection-dependent workflow synchronization.
  const [attendanceTarget, setAttendanceTarget] = useState<YouthProfile['programCycles'][number] | null>(null);
  const closeAttendanceModal = useCallback(() => setAttendanceTarget(null), []);
  const { selectedProfile, selectedProfileId, selectProfile, reconcileSavedProfile } = useYouthSelection({
    onSelectedProfileIdChange: closeAttendanceModal,
  });

  // Page actions.
  const { reconcileCreatedYouth, reconcileSavedYouth, reconcileAttendance } = useYouthActions({
    onYouthReconciled: reconcileSavedProfile,
  });

  // Profile-note actions and dialogs.
  const profileNotes = useProfileNotes(selectedProfileId);
  const openProfileNoteEditor = profileNotes.openEditor;

  // Youth modal.
  const [modalTarget, setModalTarget] = useState<YouthProfile | 'new' | null>(null);
  const schoolModal = useSchoolModal();
  const closeYouthModal = () => {
    schoolModal.close();
    setModalTarget(null);
  };

  // Primary-contact modal.
  const [contactTarget, setContactTarget] = useState<YouthProfile | null>(null);
  const closeContactModal = () => setContactTarget(null);

  // Attendance-report modal.
  const [attendanceReportTarget, setAttendanceReportTarget] = useState<{
    programCycle: YouthProfile['programCycles'][number];
    youthId: string;
  } | null>(null);
  const closeAttendanceReportModal = () => setAttendanceReportTarget(null);

  // Table configuration.
  const addProfileNote = useCallback((profile: YouthProfile) => {
    selectProfile(profile);
    openProfileNoteEditor('new', profile.id);
  }, [openProfileNoteEditor, selectProfile]);
  const { columns: youthColumns } = useYouthTable({
    canWrite,
    onEdit: setModalTarget,
    onAddNote: addProfileNote,
  });

  // Render.
  return (
    <>
      <PageContainer
        title="Profiles"
        actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
        ariaLabel="Youth profiles"
        controls={controls}
        loadingLabel="Loading saved youth preferences…"
        search={{ label: 'Search youth', placeholder: 'Search youth, school, or program' }}
        columns={youthColumns}
        messages={[
          preferencesError,
          programsError,
          cyclesError,
          viewError,
          profileNotes.error ? {
            message: profileNotes.error,
            action: { label: 'Retry', onClick: profileNotes.retry },
          } : null,
        ]}
        dashboard={<YouthDashboard
          profile={selectedProfile}
          canWrite={canWrite}
          onManagePrimaryContact={setContactTarget}
          canManageAttendance={canManageAttendance}
          onManageAttendance={setAttendanceTarget}
          canViewAttendanceReport={canViewAttendanceReport}
          onViewAttendanceReport={programCycle => {
            if (selectedProfile) setAttendanceReportTarget({ programCycle, youthId: selectedProfile.id });
          }}
          profileNotes={profileNotes.notes}
          profileNotesLoading={profileNotes.loading}
          profileNotesError={profileNotes.error}
          onRetryProfileNotes={profileNotes.retry}
          onSelectProfileNote={profileNotes.openDetails}
          onAddProfileNote={() => profileNotes.openEditor('new')}
          onEditProfileNote={profileNotes.openEditor}
          onDeleteProfileNote={profileNotes.requestDelete}
        />}
        table={<YouthTable
          columns={youthColumns}
          filters={youthFilters}
          hiddenColumnKeys={table.hiddenColumns}
          selectedProfileId={selectedProfileId}
          onSelectedProfileResolved={selectProfile}
          onRowSelect={selectProfile}
          sorting={table.sorting}
          onSortingChange={table.setSorting}
          columnWidths={table.columnWidths}
          onColumnWidthsChange={table.setColumnWidths}
          onMessageChange={setViewError}
        />}
      />

      <YouthModal
        isOpen={modalTarget !== null}
        suspended={schoolModal.action !== null}
        onManageSchool={schoolModal.open}
        youthData={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
        onClose={closeYouthModal}
        onSuccess={modalTarget === 'new' ? reconcileCreatedYouth : reconcileSavedYouth}
      />
      <SchoolModal workflow={schoolModal} />
      <YouthAttendanceModal
        youth={selectedProfile}
        programCycle={attendanceTarget}
        onClose={closeAttendanceModal}
        onSaved={reconcileAttendance}
      />
      {attendanceReportTarget && <YouthReportModal
        programCycle={attendanceReportTarget.programCycle}
        youthId={attendanceReportTarget.youthId}
        onClose={closeAttendanceReportModal}
      />}
      <YouthModal
        isOpen={contactTarget !== null}
        youthData={contactTarget ?? undefined}
        mode="contact"
        onClose={closeContactModal}
        onSuccess={reconcileSavedYouth}
      />

      <ProfileNoteDialogs
        editorTarget={profileNotes.editorTarget}
        selectedNote={profileNotes.selectedNote}
        canManage={canWrite}
        confirmingDelete={profileNotes.confirmingDelete}
        deleting={profileNotes.deleting}
        deleteError={profileNotes.deleteError}
        onCloseEditor={profileNotes.closeEditor}
        onSaved={profileNotes.handleSaved}
        onCloseDetails={profileNotes.closeDetails}
        onEdit={profileNotes.openEditor}
        onRequestDelete={profileNotes.requestDelete}
        onCancelDelete={profileNotes.cancelDelete}
        onConfirmDelete={profileNotes.confirmDelete}
      />
    </>
  );
}
