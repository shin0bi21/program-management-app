import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../common/components/Button/Button';
import Table, { TableColumn } from '../../common/components/Table/Table';
import TableDetailLayout from '../../common/components/TableDetailLayout/TableDetailLayout';
import {
  AttendanceCard,
  PrimaryContactCard,
  type NotesTab,
  YouthNotesCard,
} from '../../common/components/DetailCards/DetailCards';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import FilterCard, { type FilterCardCategory } from '../../common/components/FilterCard/FilterCard';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import { useYouth, YouthProfile } from './hooks/useYouth';
import YouthModal from './components/YouthModal/YouthModal';
import { useAuth } from '../../common/context/AuthContext';
import { calculateAge } from '../../common/utils/time';
import { usePrograms } from '../../common/hooks/usePrograms';
import useTableSelection from '../../common/hooks/useTableSelection';
import type { YouthFilters } from '../../common/types/youth';
import type { YouthSessionNote } from '../../common/types/cohort';
import { getYouthSessionNotes } from '../../common/api/youth.api';
import { STORAGE_KEYS } from '../../common/utils/storage';
import Modal from '../../common/components/Modal/Modal';
import SessionNoteDetails from '../../common/components/SessionNoteDetails/SessionNoteDetails';
import { formatShortDate } from '../../common/utils/date';
import useUserPreference from '../../common/hooks/useUserPreference';
import './Youth.css';

const initialNotesTab = (): NotesTab => (
  localStorage.getItem(STORAGE_KEYS.YOUTH_NOTES_TAB) === 'session' ? 'session' : 'profile'
);

export default function Youth() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<Array<'active' | 'inactive'>>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [filtersReady, setFiltersReady] = useState(false);
  const queryFilters = useMemo<YouthFilters | null>(() => filtersReady ? ({
    search: debouncedSearch,
    statuses: statusFilters,
    programIds: programFilters,
  }) : null, [debouncedSearch, filtersReady, programFilters, statusFilters]);
  const [modalTarget, setModalTarget] = useState<YouthProfile | 'new' | null>(null);
  const [contactTarget, setContactTarget] = useState<YouthProfile | null>(null);
  const [notesTab, setNotesTab] = useState<NotesTab>(initialNotesTab);
  const [selectedSessionNote, setSelectedSessionNote] = useState<YouthSessionNote | null>(null);
  const { permissions, role } = useAuth();
  const { programs, loading: programsLoading } = usePrograms({ assignedOnly: role === 'staff' });
  const {
    preference: savedFilters,
    loading: preferencesLoading,
    error: preferencesError,
    save: saveFilters,
  } = useUserPreference('youth-profile-filters');
  const { youth, upsertYouth, loading, error } = useYouth(queryFilters);
  const {
    selectedItem: selectedProfile,
    selectedKey: selectedProfileId,
    selectItem: selectProfile,
  } = useTableSelection(youth);
  const canWrite = permissions.includes('write:youth_profiles');
  const sessionNotesQuery = useQuery({
    queryKey: ['youth-session-notes', selectedProfileId],
    queryFn: ({ signal }) => getYouthSessionNotes(selectedProfileId!, { signal }),
    enabled: notesTab === 'session' && Boolean(selectedProfileId),
  });
  const sessionNotes = sessionNotesQuery.data ?? [];
  const sessionNotesError = sessionNotesQuery.error instanceof Error
    ? sessionNotesQuery.error.message
    : sessionNotesQuery.error ? 'Could not load session notes' : null;

  useEffect(() => {
    if (filtersReady || preferencesLoading || programsLoading) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    setStatusFilters(savedFilters?.statuses ?? ['active']);
    setProgramFilters(savedFilters
      ? savedFilters.programIds.filter(programId => availableProgramIds.has(programId))
      : role === 'staff' ? programs.map(program => program.id) : []);
    setFiltersReady(true);
  }, [filtersReady, preferencesLoading, programs, programsLoading, role, savedFilters]);

  const persistFilters = (
    statuses: Array<'active' | 'inactive'>,
    programIds: string[],
  ) => {
    void saveFilters({ statuses, programIds });
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setSelectedSessionNote(null);
  }, [notesTab, selectedProfileId]);

  const selectNotesTab = (tab: NotesTab) => {
    setNotesTab(tab);
    localStorage.setItem(STORAGE_KEYS.YOUTH_NOTES_TAB, tab);
  };

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

  const handleEditProfile = (profile: YouthProfile) => setModalTarget(profile);

  const handleSaveYouth = (savedYouth: YouthProfile) => {
    setModalTarget(null);
    setContactTarget(null);
    upsertYouth(savedYouth);
  };

  const youthColumns = useMemo<TableColumn<YouthProfile>[]>(() => [
    {
      key: 'firstName',
      header: 'First Name',
      render: (profile) => profile.firstName,
    },
    {
      key: 'lastName',
      header: 'Last Name',
      render: (profile) => profile.lastName,
    },
    {
      key: 'age',
      header: 'Age',
      render: (profile) => calculateAge(profile.dateOfBirth),
      width: '80px',
    },
    {
      key: 'school',
      header: 'School',
      render: (profile) => profile.schoolName ?? '—',
    },
    {
      key: 'grade',
      header: 'Grade',
      render: (profile) => profile.gradeLevel ?? '—',
      width: '100px',
    },
    {
      key: 'program',
      header: 'Program',
      render: (profile) => {
        const names = [...new Set(profile.cohorts.filter(cohort => cohort.withdrawnOn === null).map(cohort => cohort.programName))];
        return names.length ? names.join(', ') : '—';
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: profile => (
        <span className={`status-badge status-${profile.status}`}>
          {profile.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'col-actions',
      render: (profile) => canWrite ? (
        <ActionsMenu
          ariaLabel={`More actions for ${profile.firstName} ${profile.lastName}`}
          items={[{ id: 'edit', label: 'Edit', onClick: () => handleEditProfile(profile) }]}
        />
      ) : null,
    },
  ], [canWrite]);

  return (
    <>
      <div className="data-detail-page-content">
        <PageHeader
          title="Profiles"
          actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
          search={<SearchInput label="Search youth" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search youth, school, or program" />}
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
        {preferencesError && <p role="alert">{preferencesError}</p>}

        <TableDetailLayout
          ariaLabel="Youth profiles"
          table={<Table ariaLabel="Youth profiles" columns={youthColumns} data={youth} loading={loading} error={error} emptyMessage={search || statusFilters.length || programFilters.length ? 'No youth profiles match these filters' : 'No youth profiles found'} keyExtractor={profile => profile.id} selectedKey={selectedProfileId} onRowSelect={selectProfile} />}
          details={<>
            <PrimaryContactCard
              contact={selectedProfile?.contacts?.[0] ? {
                phoneNumber: selectedProfile.contacts[0].phoneNumber,
                relationship: selectedProfile.contacts[0].type,
              } : null}
              selected={selectedProfile !== null}
              action={canWrite ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!selectedProfile}
                  aria-label="Manage primary contact"
                  onClick={() => {
                    if (selectedProfile) setContactTarget(selectedProfile);
                  }}
                >
                  Manage
                </Button>
              ) : undefined}
            />
            <AttendanceCard
              cohorts={selectedProfile?.cohorts}
              selected={selectedProfile !== null}
            />
            <YouthNotesCard
              notes={selectedProfile?.notes}
              selected={selectedProfile !== null}
              activeTab={notesTab}
              onTabChange={selectNotesTab}
              sessionNotes={sessionNotes}
              sessionNotesLoading={sessionNotesQuery.isLoading}
              sessionNotesError={sessionNotesError}
              onSelectSessionNote={setSelectedSessionNote}
            />
          </>}
        />
      </div>

      <YouthModal
        isOpen={modalTarget !== null}
        youthData={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
        onClose={() => setModalTarget(null)}
        onSuccess={handleSaveYouth}
      />
      <YouthModal
        isOpen={contactTarget !== null}
        youthData={contactTarget ?? undefined}
        mode="contact"
        onClose={() => setContactTarget(null)}
        onSuccess={handleSaveYouth}
      />

      <Modal
        isOpen={selectedSessionNote !== null}
        onClose={() => setSelectedSessionNote(null)}
        title={selectedSessionNote?.title ?? ''}
        footer={(
          <Button variant="secondary" onClick={() => setSelectedSessionNote(null)}>
            Close
          </Button>
        )}
      >
        {selectedSessionNote && (
          <SessionNoteDetails
            note={selectedSessionNote}
            context={[
              selectedSessionNote.programName,
              selectedSessionNote.cohortName,
              selectedSessionNote.sessionTheme,
              formatShortDate(selectedSessionNote.startsAt),
            ].filter(Boolean).join(' · ')}
          />
        )}
      </Modal>
    </>
  );
}
