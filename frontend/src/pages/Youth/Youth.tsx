import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/authContext';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../common/components/FilterCard/FilterCard';
import PageBody from '../../common/components/PageBody/PageBody';
import PageErrorOverlay, { type PageErrorItem } from '../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import type { CellContext } from '@tanstack/react-table';
import type { TableColumnDef } from '../../common/components/Table/Table.types';
import YouthReportModal from '../../common/features/programming/components/YouthReportModal/YouthReportModal';
import { COHORT_QUERY_KEY, SESSION_QUERY_KEY } from '../../common/features/programming/queryKeys';
import { usePrograms } from '../../common/features/programs/hooks/usePrograms';
import YouthModal from '../../common/features/youth/components/YouthModal/YouthModal';
import { YOUTH_QUERY_KEY } from '../../common/features/youth/queryKeys';
import { YOUTH_TABLE_KEYS } from '../../common/types/youth';
import { calculateAge } from '../../common/utils/time';
import ProfileNoteDialogs from './components/ProfileNotes/ProfileNoteDialogs';
import useProfileNotes from './components/ProfileNotes/useProfileNotes';
import YouthAttendanceModal from './components/YouthAttendanceModal/YouthAttendanceModal';
import YouthDashboard from './components/YouthDashboard/YouthDashboard';
import YouthTable from './components/YouthTable/YouthTable';
import { useYouthControls } from './hooks/useYouthControls';
import type { YouthProfile } from './types';
import './Youth.css';

export default function Youth() {
  // Page-local errors.
  const [viewError, setViewError] = useState<PageErrorItem | null>(null);

  // Permissions and services.
  const queryClient = useQueryClient();
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

  // Selection.
  const [selectedProfile, setSelectedProfile] = useState<YouthProfile | null>(null);
  const selectedProfileId = selectedProfile?.id ?? null;
  const selectProfile = setSelectedProfile;

  // Profile-note actions and dialogs.
  const profileNotes = useProfileNotes(selectedProfileId);
  const openProfileNoteEditor = profileNotes.openEditor;

  // Youth modal.
  const [modalTarget, setModalTarget] = useState<YouthProfile | 'new' | null>(null);
  const closeYouthModal = () => setModalTarget(null);

  // Primary-contact modal.
  const [contactTarget, setContactTarget] = useState<YouthProfile | null>(null);
  const closeContactModal = () => setContactTarget(null);

  // Attendance modal.
  const [attendanceTarget, setAttendanceTarget] = useState<YouthProfile['cohorts'][number] | null>(null);
  const closeAttendanceModal = () => setAttendanceTarget(null);

  // Keep cohort-specific dialogs aligned with the selected profile.
  useEffect(() => {
    setAttendanceTarget(null);
  }, [selectedProfileId]);

  // Attendance-report modal.
  const [attendanceReportTarget, setAttendanceReportTarget] = useState<{
    cohort: YouthProfile['cohorts'][number];
    youthId: string;
  } | null>(null);
  const closeAttendanceReportModal = () => setAttendanceReportTarget(null);

  // Page actions.
  const handleSaveYouth = () => {
    void queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY });
  };

  // Table configuration.
  const youthColumns = useMemo<TableColumnDef<YouthProfile>[]>(() => [
    {
      id: 'firstName',
      header: 'First Name',
      accessorFn: profile => profile.firstName,
    },
    {
      id: 'lastName',
      header: 'Last Name',
      accessorFn: profile => profile.lastName,
    },
    {
      id: 'age',
      header: 'Age',
      accessorFn: profile => calculateAge(profile.dateOfBirth),
      size: 100,
    },
    {
      id: 'school',
      header: 'School',
      accessorFn: profile => profile.schoolName ?? '—',
    },
    {
      id: 'grade',
      header: 'Grade',
      accessorFn: profile => profile.gradeLevel ?? '—',
      size: 100,
    },
    {
      id: 'program',
      header: 'Program',
      accessorFn: profile => {
        const names = [...new Set(profile.cohorts.filter(cohort => cohort.withdrawnOn === null).map(cohort => cohort.programName))];
        return names.length ? names.join(', ') : '—';
      },
    },
    {
      id: 'status',
      header: 'Status',
      size: 110,
      accessorFn: profile => profile.status,
      cell: ({ row: { original: profile } }: CellContext<YouthProfile, unknown>) => (
        <span className={`status-badge status-${profile.status}`}>
          {profile.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    ...(canWrite ? [{
      id: 'actions' as const,
      size: 40,
      enableResizing: false,
      enableHiding: false,
      header: '',
      cell: ({ row: { original: profile } }: CellContext<YouthProfile, unknown>) => (
        <ActionsMenu
          ariaLabel={`More actions for ${profile.firstName} ${profile.lastName}`}
          items={[
            { id: 'edit', label: 'Edit Profile', onClick: () => setModalTarget(profile) },
            { id: 'add-note', label: 'Add Note', onClick: () => { selectProfile(profile); openProfileNoteEditor('new', profile.id); } },
          ]}
        />
      ),
    }] : []),
  ], [canWrite, openProfileNoteEditor, selectProfile]);

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
            onSelectedProfileResolved={setSelectedProfile}
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
            onEditProfileNote={profileNotes.openEditor}
            onDeleteProfileNote={profileNotes.requestDelete}
          />}
        />}
      </main>

      <YouthModal
        isOpen={modalTarget !== null}
        youthData={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
        onClose={closeYouthModal}
        onSuccess={handleSaveYouth}
      />
      <YouthAttendanceModal
        youth={selectedProfile}
        cohort={attendanceTarget}
        onClose={closeAttendanceModal}
        onSaved={() => Promise.all([
          queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
        ]).then(() => undefined)}
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
        onSuccess={handleSaveYouth}
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
