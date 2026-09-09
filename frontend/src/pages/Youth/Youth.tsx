import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../../auth/authContext';
import Button from '../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../common/components/FilterCard/FilterCard';
import PageBody from '../../common/components/PageBody/PageBody';
import PageErrorOverlay, { type PageErrorItem } from '../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import YouthReportModal from '../../common/features/YouthReportModal/YouthReportModal';
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
  const [viewError, setViewError] = useState<PageErrorItem | null>(null);

  // Permissions and services.
  const { permissions, role } = useAuth();
  const canWrite = permissions.includes('write:youth_profiles');
  const canManageAttendance = permissions.includes('read:attendance')
    && permissions.includes('write:attendance')
    && permissions.includes('read:sessions');
  const canViewAttendanceReport = permissions.includes('read:cohorts')
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
    statuses: filters.statuses,
    programIds: filters.programIds,
    cycleIds: filters.cycleIds,
  } : null, [search.appliedValue, controlsReady, filters.programIds, filters.cycleIds, filters.statuses]);

  // Selection and selection-dependent workflow synchronization.
  const [attendanceTarget, setAttendanceTarget] = useState<YouthProfile['cohorts'][number] | null>(null);
  const closeAttendanceModal = useCallback(() => setAttendanceTarget(null), []);
  const { selectedProfile, selectedProfileId, selectProfile, reconcileSavedProfile } = useYouthSelection({
    onSelectedProfileIdChange: closeAttendanceModal,
  });

  // Page actions.
  const { reconcileCreatedYouth, reconcileSavedYouth, refreshAttendance } = useYouthActions({
    onYouthReconciled: reconcileSavedProfile,
  });

  // Profile-note actions and dialogs.
  const profileNotes = useProfileNotes(selectedProfileId);
  const openProfileNoteEditor = profileNotes.openEditor;

  // Youth modal.
  const [modalTarget, setModalTarget] = useState<YouthProfile | 'new' | null>(null);
  const closeYouthModal = () => setModalTarget(null);

  // Primary-contact modal.
  const [contactTarget, setContactTarget] = useState<YouthProfile | null>(null);
  const closeContactModal = () => setContactTarget(null);

  // Attendance-report modal.
  const [attendanceReportTarget, setAttendanceReportTarget] = useState<{
    cohort: YouthProfile['cohorts'][number];
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
      <main className="page-container">
        <PageHeader
          title="Profiles"
          actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
          search={<SearchInput
            label="Search youth"
            value={search.value}
            appliedValue={search.appliedValue}
            onChange={event => search.setValue(event.target.value)}
            onApply={search.apply}
            onClear={search.clear}
            placeholder="Search youth, school, or program"
          />}
          columns={controlsReady ? <ColumnVisibilityMenu
            columns={youthColumns}
            hiddenColumnKeys={table.hiddenColumns}
            onHiddenColumnKeysChange={table.setHiddenColumns}
          /> : undefined}
          filters={controlsReady ? <FilterCard
            categories={filters.definitions}
            values={{ status: filters.statuses, program: filters.programIds, cycle: filters.cycleIds }}
            onApply={filters.apply}
            onClearAll={filters.clear}
          /> : undefined}
        />
        <PageErrorOverlay errors={[
          preferencesError,
          programsError,
          cyclesError,
          viewError,
          profileNotes.error ? {
            message: profileNotes.error,
            action: { label: 'Retry', onClick: profileNotes.retry },
          } : null,
        ]} />

        {!controlsReady ? <p role="status">Loading saved youth preferences…</p> : <PageBody
          ariaLabel="Youth profiles"
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
            onErrorChange={setViewError}
          />}
          dashboard={<YouthDashboard
            profile={selectedProfile}
            canWrite={canWrite}
            onManagePrimaryContact={setContactTarget}
            canManageAttendance={canManageAttendance}
            onManageAttendance={setAttendanceTarget}
            canViewAttendanceReport={canViewAttendanceReport}
            onViewAttendanceReport={cohort => {
              if (selectedProfile) setAttendanceReportTarget({ cohort, youthId: selectedProfile.id });
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
        />}
      </main>

      <YouthModal
        isOpen={modalTarget !== null}
        youthData={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
        onClose={closeYouthModal}
        onSuccess={modalTarget === 'new' ? reconcileCreatedYouth : reconcileSavedYouth}
      />
      <YouthAttendanceModal
        youth={selectedProfile}
        cohort={attendanceTarget}
        onClose={closeAttendanceModal}
        onSaved={refreshAttendance}
      />
      {attendanceReportTarget && <YouthReportModal
        cohort={attendanceReportTarget.cohort}
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
