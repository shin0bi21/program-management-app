import { useCallback, useState } from 'react';
import { useAuth } from '../../auth/authContext';
import Button from '../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../common/components/FilterCard/FilterCard';
import PageBody from '../../common/components/PageBody/PageBody';
import PageErrorOverlay, { type PageErrorItem } from '../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import YouthReportModal from '../../common/features/programming/components/YouthReportModal/YouthReportModal';
import { usePrograms } from '../../common/features/programs/hooks/usePrograms';
import YouthModal from '../../common/features/youth/components/YouthModal/YouthModal';
import { YOUTH_TABLE_KEYS } from '../../common/types/youth';
import ProfileNoteDialogs from './components/ProfileNotes/ProfileNoteDialogs';
import useProfileNotes from './components/ProfileNotes/useProfileNotes';
import YouthAttendanceModal from './components/YouthAttendanceModal/YouthAttendanceModal';
import YouthDashboard from './components/YouthDashboard/YouthDashboard';
import YouthTable from './components/YouthTable/YouthTable';
import useYouthTable from './components/YouthTable/hooks/useYouthTable';
import { useYouthActions } from './hooks/actions/useYouthActions';
import { useYouthSelection } from './hooks/selection/useYouthSelection';
import { useYouthControls } from './hooks/useYouthControls';
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
  const { programs, loading: programsLoading, error: programsError } = usePrograms({ assignedOnly: role === 'staff' });
  const controls = useYouthControls({
    role,
    programs,
    programsLoading,
    programsError,
    tableKeys: YOUTH_TABLE_KEYS,
  });
  const {
    search, setSearch, appliedSearch, applySearch, clearSearch, queryFilters, statusFilters, programFilters, sorting,
    columnWidths, hiddenColumns, error: preferencesError, filterCategories,
    hasActiveQueryFilters, ready: controlsReady,
  } = controls;

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
      <main className="page-container page-container--data">
        <PageHeader
          title="Profiles"
          actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
          search={<SearchInput
            label="Search youth"
            value={search}
            appliedValue={appliedSearch}
            onChange={event => setSearch(event.target.value)}
            onApply={applySearch}
            onClear={clearSearch}
            placeholder="Search youth, school, or program"
          />}
          columns={controlsReady ? <ColumnVisibilityMenu
            columns={youthColumns}
            hiddenColumnKeys={hiddenColumns}
            onHiddenColumnKeysChange={controls.setHiddenColumns}
          /> : undefined}
          filters={controlsReady ? <FilterCard
            categories={filterCategories}
            values={{ status: statusFilters, program: programFilters }}
            onApply={controls.applyFilter}
            onClearAll={controls.clearFilters}
          /> : undefined}
        />
        <PageErrorOverlay errors={[
          preferencesError,
          programsError,
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
            filters={queryFilters}
            hiddenColumnKeys={hiddenColumns}
            selectedProfileId={selectedProfileId}
            hasActiveQueryFilters={hasActiveQueryFilters}
            onSelectedProfileResolved={selectProfile}
            onRowSelect={selectProfile}
            sorting={sorting}
            onSortingChange={controls.setSorting}
            columnWidths={columnWidths}
            onColumnWidthsChange={controls.setColumnWidths}
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
