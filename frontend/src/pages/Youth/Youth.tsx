import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/authContext';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../common/components/FilterCard/FilterCard';
import PageBody from '../../common/components/PageBody/PageBody';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../common/components/Table/Table';
import useTableSelection from '../../common/components/Table/hooks/useTableSelection';
import YouthReportModal from '../../common/features/programming/components/YouthReportModal/YouthReportModal';
import { COHORT_QUERY_KEY, SESSION_QUERY_KEY } from '../../common/features/programming/queryKeys';
import { usePrograms } from '../../common/features/programs/hooks/usePrograms';
import YouthModal from '../../common/features/youth/components/YouthModal/YouthModal';
import { YOUTH_QUERY_KEY } from '../../common/features/youth/queryKeys';
import { calculateAge } from '../../common/utils/time';
import ProfileNoteDialogs from './components/ProfileNotes/ProfileNoteDialogs';
import useProfileNotes from './components/ProfileNotes/useProfileNotes';
import YouthAttendanceModal from './components/YouthAttendanceModal/YouthAttendanceModal';
import YouthDashboard from './components/YouthDashboard/YouthDashboard';
import { useYouthControls } from './hooks/useYouthControls';
import { useYouth, type YouthProfile } from './hooks/useYouth';
import './Youth.css';

const YOUTH_COLUMN_KEYS = [
  'firstName',
  'lastName',
  'age',
  'school',
  'grade',
  'program',
  'status',
] as const;

export default function Youth() {
  // Application services and permission capabilities.
  const queryClient = useQueryClient();
  const { permissions, role } = useAuth();
  const canWrite = permissions.includes('write:youth_profiles');
  const canManageSessionNotes = permissions.includes('write:sessions');
  const canManageAttendance = permissions.includes('read:attendance')
    && permissions.includes('write:attendance')
    && permissions.includes('read:sessions');
  const canViewAttendanceReport = permissions.includes('read:cohorts')
    && permissions.includes('read:attendance')
    && permissions.includes('read:sessions');

  // Shared options and persisted page controls.
  const { programs, loading: programsLoading, error: programsError } = usePrograms({ assignedOnly: role === 'staff' });
  const controls = useYouthControls({
    role,
    programs,
    programsLoading,
    programsError,
    columnKeys: YOUTH_COLUMN_KEYS,
  });
  const {
    search, setSearch, queryFilters, statusFilters, programFilters, sorting,
    columnWidths, hiddenColumns, error: preferencesError, filterCategories,
    hasActiveQueryFilters,
  } = controls;

  // Remote records and selection.
  const { youth, loading, refreshing, error, hasNextPage, loadingNextPage, loadNextPage } = useYouth(queryFilters, sorting);
  const {
    selectedItem: selectedProfile,
    selectedKey: selectedProfileId,
    selectItem: selectProfile,
  } = useTableSelection(youth);
  const [modalTarget, setModalTarget] = useState<YouthProfile | 'new' | null>(null);
  const [contactTarget, setContactTarget] = useState<YouthProfile | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<YouthProfile['cohorts'][number] | null>(null);
  const [attendanceReportTarget, setAttendanceReportTarget] = useState<{
    cohort: YouthProfile['cohorts'][number];
    youthId: string;
  } | null>(null);
  const profileNotes = useProfileNotes(selectedProfileId);
  const openProfileNoteEditor = profileNotes.openEditor;

  // Keep cohort-specific dialogs aligned with the selected profile.
  useEffect(() => {
    setAttendanceTarget(null);
  }, [selectedProfileId]);

  // Page actions and table presentation.
  const handleSaveYouth = () => {
    setModalTarget(null);
    setContactTarget(null);
    void queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY });
  };

  const youthColumns = useMemo<TableColumn<YouthProfile>[]>(() => [
    {
      key: 'firstName',
      sortKey: 'firstName',
      header: 'First Name',
      render: (profile) => profile.firstName,
    },
    {
      key: 'lastName',
      sortKey: 'lastName',
      header: 'Last Name',
      render: (profile) => profile.lastName,
    },
    {
      key: 'age',
      sortKey: 'age',
      header: 'Age',
      render: (profile) => calculateAge(profile.dateOfBirth),
      width: 100,
    },
    {
      key: 'school',
      sortKey: 'school',
      header: 'School',
      render: (profile) => profile.schoolName ?? '—',
    },
    {
      key: 'grade',
      sortKey: 'grade',
      header: 'Grade',
      render: (profile) => profile.gradeLevel ?? '—',
      width: 100,
    },
    {
      key: 'program',
      sortKey: 'program',
      header: 'Program',
      render: (profile) => {
        const names = [...new Set(profile.cohorts.filter(cohort => cohort.withdrawnOn === null).map(cohort => cohort.programName))];
        return names.length ? names.join(', ') : '—';
      },
    },
    {
      key: 'status',
      sortKey: 'status',
      header: 'Status',
      width: 110,
      render: profile => (
        <span className={`status-badge status-${profile.status}`}>
          {profile.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      width: 40,
      resizable: false,
      header: '',
      className: 'col-actions',
      render: (profile) => canWrite ? (
        <ActionsMenu
          ariaLabel={`More actions for ${profile.firstName} ${profile.lastName}`}
          items={[
            { id: 'edit', label: 'Edit Profile', onClick: () => setModalTarget(profile) },
            { id: 'add-note', label: 'Add Note', onClick: () => { selectProfile(profile); openProfileNoteEditor('new', profile.id); } },
          ]}
        />
      ) : null,
    },
  ], [canWrite, openProfileNoteEditor, selectProfile]);

  return (
    <>
      <main className="page-container page-container--data">
        <PageHeader
          title="Profiles"
          actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
          search={<SearchInput
            label="Search youth"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search youth, school, or program"
          />}
          columns={<ColumnVisibilityMenu
            columns={youthColumns}
            hiddenColumnKeys={hiddenColumns}
            onHiddenColumnKeysChange={controls.setHiddenColumns}
          />}
          filters={<FilterCard
            categories={filterCategories}
            values={{ status: statusFilters, program: programFilters }}
            onApply={controls.applyFilter}
            onClearAll={controls.clearFilters}
          />}
        />
        {preferencesError && <p className="form-error" role="alert">{preferencesError}</p>}
        {programsError && <p className="form-error" role="alert">{programsError}</p>}

        <PageBody
          ariaLabel="Youth profiles"
          table={<Table
            ariaLabel="Youth profiles"
            columns={youthColumns}
            hiddenColumnKeys={hiddenColumns}
            data={youth}
            loading={loading}
            refreshing={refreshing}
            error={error}
            emptyMessage={hasActiveQueryFilters
              ? 'No youth profiles match these filters'
              : 'No youth profiles found'}
            keyExtractor={profile => profile.id}
            selectedKey={selectedProfileId}
            onRowSelect={selectProfile}
            sorting={sorting}
            onSortingChange={controls.setSorting}
            columnWidths={columnWidths}
            onColumnWidthsChange={controls.setColumnWidths}
            hasNextPage={hasNextPage}
            loadingNextPage={loadingNextPage}
            onLoadNextPage={loadNextPage}
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
            onSelectProfileNote={profileNotes.openDetails}
            onEditProfileNote={profileNotes.openEditor}
            onDeleteProfileNote={profileNotes.requestDelete}
          />}
        />
      </main>

      <YouthModal
        isOpen={modalTarget !== null}
        youthData={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
        onClose={() => setModalTarget(null)}
        onSuccess={handleSaveYouth}
      />
      <YouthAttendanceModal
        youth={selectedProfile}
        cohort={attendanceTarget}
        canManageSessionNotes={canManageSessionNotes}
        onClose={() => setAttendanceTarget(null)}
        onSaved={() => Promise.all([
          queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
        ]).then(() => undefined)}
      />
      {attendanceReportTarget && <YouthReportModal
        cohort={attendanceReportTarget.cohort}
        youthId={attendanceReportTarget.youthId}
        onClose={() => setAttendanceReportTarget(null)}
      />}
      <YouthModal
        isOpen={contactTarget !== null}
        youthData={contactTarget ?? undefined}
        mode="contact"
        onClose={() => setContactTarget(null)}
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
