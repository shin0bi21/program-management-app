import { useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Button from '../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import Table, { TableColumn } from '../../common/components/Table/Table';
import PageBody from '../../common/components/PageBody/PageBody';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import FilterCard, { type FilterCardCategory } from '../../common/components/FilterCard/FilterCard';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import { useYouth, YouthProfile } from './hooks/useYouth';
import { YOUTH_QUERY_KEY } from '../../common/features/youth/queryKeys';
import { COHORT_QUERY_KEY, SESSION_QUERY_KEY } from '../../common/features/programming/queryKeys';
import YouthModal from '../../common/features/youth/components/YouthModal/YouthModal';
import { useAuth } from '../../auth/authContext';
import { calculateAge } from '../../common/utils/time';
import { usePrograms } from '../../common/features/programs/hooks/usePrograms';
import useTableSelection from '../../common/components/Table/hooks/useTableSelection';
import type { YouthFilters, YouthSortKey } from '../../common/types/youth';
import type { ListSort } from '../../common/types/pagination';
import useUserPreference from '../../common/features/preferences/hooks/useUserPreference';
import './Youth.css';
import ProfileNoteDialogs from './components/ProfileNotes/ProfileNoteDialogs';
import useProfileNotes from './components/ProfileNotes/useProfileNotes';
import YouthAttendanceModal from './components/YouthAttendanceModal/YouthAttendanceModal';
import YouthReportModal from '../../common/features/programming/components/YouthReportModal/YouthReportModal';
import YouthDashboard from './components/YouthDashboard/YouthDashboard';

export default function Youth() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<Array<'active' | 'inactive'>>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [filtersReady, setFiltersReady] = useState(false);
  const [sorting, setSorting] = useState<ListSort<YouthSortKey>>({ key: 'firstName', direction: 'asc' });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const queryFilters = useMemo<YouthFilters | null>(() => filtersReady ? ({
    search: debouncedSearch,
    statuses: statusFilters,
    programIds: programFilters,
  }) : null, [debouncedSearch, filtersReady, programFilters, statusFilters]);
  const [modalTarget, setModalTarget] = useState<YouthProfile | 'new' | null>(null);
  const [contactTarget, setContactTarget] = useState<YouthProfile | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<YouthProfile['cohorts'][number] | null>(null);
  const [attendanceReportTarget, setAttendanceReportTarget] = useState<{
    cohort: YouthProfile['cohorts'][number];
    youthId: string;
  } | null>(null);
  const { permissions, role } = useAuth();
  const { programs, loading: programsLoading } = usePrograms({ assignedOnly: role === 'staff' });
  const {
    preference: savedFilters,
    loading: preferencesLoading,
    error: preferencesError,
    save: saveFilters,
  } = useUserPreference('youth-profile-filters');
  const { youth, loading, refreshing, error, hasNextPage, loadingNextPage, loadNextPage } = useYouth(queryFilters, sorting);
  const {
    selectedItem: selectedProfile,
    selectedKey: selectedProfileId,
    selectItem: selectProfile,
  } = useTableSelection(youth);
  const canWrite = permissions.includes('write:youth_profiles');
  const canManageSessionNotes = permissions.includes('write:sessions');
  const canManageAttendance = permissions.includes('read:attendance')
    && permissions.includes('write:attendance')
    && permissions.includes('read:sessions');
  const canViewAttendanceReport = permissions.includes('read:cohorts')
    && permissions.includes('read:attendance')
    && permissions.includes('read:sessions');
  const profileNotes = useProfileNotes(selectedProfileId);
  const openProfileNoteEditor = profileNotes.openEditor;

  useEffect(() => {
    if (filtersReady || preferencesLoading || programsLoading) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    setStatusFilters(savedFilters?.statuses ?? ['active']);
    setProgramFilters(savedFilters
      ? savedFilters.programIds.filter(programId => availableProgramIds.has(programId))
      : role === 'staff' ? programs.map(program => program.id) : []);
    setSorting(savedFilters?.sorting ?? { key: 'firstName', direction: 'asc' });
    setColumnWidths(savedFilters?.columnWidths ?? {});
    setFiltersReady(true);
  }, [filtersReady, preferencesLoading, programs, programsLoading, role, savedFilters]);

  const persistFilters = (
    statuses: Array<'active' | 'inactive'>,
    programIds: string[],
  ) => {
    void saveFilters({ statuses, programIds, sorting, columnWidths });
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setAttendanceTarget(null);
  }, [selectedProfileId]);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'program',
      label: 'Program',
      options: programs.map(program => ({ value: program.id, label: program.name })),
    },
    {
      id: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  ], [programs]);

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
          search={<SearchInput label="Search youth" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search youth, school, or program" />}
          columns={<ColumnVisibilityMenu columns={youthColumns} hiddenColumnKeys={savedFilters?.hiddenColumns ?? []} onHiddenColumnKeysChange={hiddenColumns => void saveFilters({ statuses: statusFilters, programIds: programFilters, sorting, columnWidths, hiddenColumns })} />}
          filters={<FilterCard
            categories={filterCategories}
            values={{ status: statusFilters, program: programFilters }}
            onApply={(category, selected) => {
              if (category === 'status') {
                const statuses = selected as Array<'active' | 'inactive'>;
                setStatusFilters(statuses);
                persistFilters(statuses, programFilters);
              }
              if (category === 'program') {
                setProgramFilters(selected);
                persistFilters(statusFilters, selected);
              }
            }}
            onClearAll={() => {
              setStatusFilters([]);
              setProgramFilters([]);
              persistFilters([], []);
            }}
          />}
        />
        {preferencesError && <p className="form-error" role="alert">{preferencesError}</p>}

        <PageBody
          ariaLabel="Youth profiles"
          table={<Table ariaLabel="Youth profiles" columns={youthColumns} hiddenColumnKeys={savedFilters?.hiddenColumns ?? []} data={youth} loading={loading} refreshing={refreshing} error={error} emptyMessage={search || statusFilters.length || programFilters.length ? 'No youth profiles match these filters' : 'No youth profiles found'} keyExtractor={profile => profile.id} selectedKey={selectedProfileId} onRowSelect={selectProfile} sorting={sorting} onSortingChange={next => { const value = next as ListSort<YouthSortKey>; setSorting(value); void saveFilters({ statuses: statusFilters, programIds: programFilters, sorting: value, columnWidths }); }} columnWidths={columnWidths} onColumnWidthsChange={next => { setColumnWidths(next); void saveFilters({ statuses: statusFilters, programIds: programFilters, sorting, columnWidths: next }); }} hasNextPage={hasNextPage} loadingNextPage={loadingNextPage} onLoadNextPage={loadNextPage} />}
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
