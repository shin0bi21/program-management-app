import { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { YouthFilters, YouthProfileNote, YouthSortKey } from '../../common/types/youth';
import type { ListSort } from '../../common/types/pagination';
import type { YouthSessionNote } from '../../common/types/cohort';
import { deleteYouthProfileNote, getYouthProfileNotes, getYouthSessionNotes } from '../../common/api/youth.api';
import { STORAGE_KEYS } from '../../common/utils/storage';
import Modal from '../../common/components/Modal/Modal';
import SessionNoteDetails from '../../common/components/SessionNoteDetails/SessionNoteDetails';
import { formatShortDate } from '../../common/utils/date';
import useUserPreference from '../../common/hooks/useUserPreference';
import './Youth.css';
import ProfileNoteModal from './components/ProfileNoteModal/ProfileNoteModal';
import ProfileNoteDetails from '../../common/components/ProfileNoteDetails/ProfileNoteDetails';
import { getErrorMessage } from '../../common/utils/clientErrors';
import SessionNoteModal from '../Programming/Sessions/components/SessionNoteModal/SessionNoteModal';
import { deleteSessionNote } from '../../common/api/cohorts.api';

const initialNotesTab = (): NotesTab => (
  localStorage.getItem(STORAGE_KEYS.YOUTH_NOTES_TAB) === 'session' ? 'session' : 'profile'
);

export default function Youth() {
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
  const [notesTab, setNotesTab] = useState<NotesTab>(initialNotesTab);
  const [selectedSessionNote, setSelectedSessionNote] = useState<YouthSessionNote | null>(null);
  const [sessionNoteEditTarget, setSessionNoteEditTarget] = useState<YouthSessionNote | null>(null);
  const [sessionNoteDeleteTarget, setSessionNoteDeleteTarget] = useState<YouthSessionNote | null>(null);
  const [deletingSessionNote, setDeletingSessionNote] = useState(false);
  const [sessionNoteDeleteError, setSessionNoteDeleteError] = useState('');
  const [profileNoteTarget, setProfileNoteTarget] = useState<YouthProfileNote | 'new' | null>(null);
  const [selectedProfileNote, setSelectedProfileNote] = useState<YouthProfileNote | null>(null);
  const [confirmingProfileNoteDelete, setConfirmingProfileNoteDelete] = useState(false);
  const [deletingProfileNote, setDeletingProfileNote] = useState(false);
  const [profileNoteDeleteError, setProfileNoteDeleteError] = useState('');
  const queryClient = useQueryClient();
  const { permissions, role } = useAuth();
  const { programs, loading: programsLoading } = usePrograms({ assignedOnly: role === 'staff' });
  const {
    preference: savedFilters,
    loading: preferencesLoading,
    error: preferencesError,
    save: saveFilters,
  } = useUserPreference('youth-profile-filters');
  const { youth, upsertYouth, loading, refreshing, error, hasNextPage, loadingNextPage, loadNextPage } = useYouth(queryFilters, sorting);
  const {
    selectedItem: selectedProfile,
    selectedKey: selectedProfileId,
    selectItem: selectProfile,
  } = useTableSelection(youth);
  const canWrite = permissions.includes('write:youth_profiles');
  const canManageSessionNotes = permissions.includes('write:sessions');
  const sessionNotesQuery = useQuery({
    queryKey: ['youth-session-notes', selectedProfileId],
    queryFn: ({ signal }) => getYouthSessionNotes(selectedProfileId!, { signal }),
    enabled: notesTab === 'session' && Boolean(selectedProfileId),
  });
  const sessionNotes = sessionNotesQuery.data ?? [];
  const profileNotesQuery = useQuery({
    queryKey: ['youth-profile-notes', selectedProfileId],
    queryFn: ({ signal }) => getYouthProfileNotes(selectedProfileId!, { signal }),
    enabled: notesTab === 'profile' && Boolean(selectedProfileId),
  });
  const profileNotes = profileNotesQuery.data ?? [];
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
    setSelectedSessionNote(null);
    setSessionNoteEditTarget(null);
    setSessionNoteDeleteTarget(null);
    setDeletingSessionNote(false);
    setSessionNoteDeleteError('');
    setSelectedProfileNote(null);
    setConfirmingProfileNoteDelete(false);
    setDeletingProfileNote(false);
    setProfileNoteDeleteError('');
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
            { id: 'edit', label: 'Edit Profile', onClick: () => handleEditProfile(profile) },
            { id: 'add-note', label: 'Add Note', onClick: () => { selectProfile(profile); setNotesTab('profile'); setProfileNoteTarget('new'); } },
          ]}
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
        {preferencesError && <p className="form-error" role="alert">{preferencesError}</p>}

        <TableDetailLayout
          ariaLabel="Youth profiles"
          table={<Table ariaLabel="Youth profiles" columns={youthColumns} data={youth} loading={loading} refreshing={refreshing} error={error} emptyMessage={search || statusFilters.length || programFilters.length ? 'No youth profiles match these filters' : 'No youth profiles found'} keyExtractor={profile => profile.id} selectedKey={selectedProfileId} onRowSelect={selectProfile} sorting={sorting} onSortingChange={next => { const value = next as ListSort<YouthSortKey>; setSorting(value); void saveFilters({ statuses: statusFilters, programIds: programFilters, sorting: value, columnWidths }); }} columnWidths={columnWidths} onColumnWidthsChange={next => { setColumnWidths(next); void saveFilters({ statuses: statusFilters, programIds: programFilters, sorting, columnWidths: next }); }} hasNextPage={hasNextPage} loadingNextPage={loadingNextPage} onLoadNextPage={loadNextPage} />}
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
              profileNotes={profileNotes}
              selected={selectedProfile !== null}
              activeTab={notesTab}
              onTabChange={selectNotesTab}
              sessionNotes={sessionNotes}
              sessionNotesLoading={sessionNotesQuery.isLoading}
              sessionNotesError={sessionNotesError}
              onSelectSessionNote={setSelectedSessionNote}
              canManageSessionNotes={canManageSessionNotes}
              onEditSessionNote={setSessionNoteEditTarget}
              onDeleteSessionNote={note => {
                setSessionNoteDeleteTarget(note);
                setSessionNoteDeleteError('');
              }}
              onSelectProfileNote={setSelectedProfileNote}
              canManageProfileNotes={canWrite}
              onEditProfileNote={note => setProfileNoteTarget(note)}
              onDeleteProfileNote={note => {
                setSelectedProfileNote(note);
                setConfirmingProfileNoteDelete(true);
                setProfileNoteDeleteError('');
              }}
              profileNotesLoading={profileNotesQuery.isLoading}
              profileNotesError={profileNotesQuery.error ? 'Could not load profile notes' : null}
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
      <SessionNoteModal
        session={sessionNoteEditTarget ? {
          id: sessionNoteEditTarget.sessionId,
          rosterMode: sessionNoteEditTarget.rosterMode,
        } : null}
        note={sessionNoteEditTarget}
        onClose={() => setSessionNoteEditTarget(null)}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ['youth-session-notes', selectedProfileId] });
        }}
      />
      <Modal
        isOpen={sessionNoteDeleteTarget !== null}
        onClose={() => {
          if (deletingSessionNote) return;
          setSessionNoteDeleteTarget(null);
          setSessionNoteDeleteError('');
        }}
        title="Delete Session Note"
        status={sessionNoteDeleteError ? 'error' : deletingSessionNote ? 'submitting' : 'idle'}
        statusMessage={sessionNoteDeleteError || (deletingSessionNote ? 'Deleting session note...' : undefined)}
        disableClose={deletingSessionNote}
        footer={<>
          <Button variant="secondary" disabled={deletingSessionNote} onClick={() => setSessionNoteDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" disabled={deletingSessionNote} onClick={async () => {
            if (!sessionNoteDeleteTarget) return;
            setDeletingSessionNote(true);
            setSessionNoteDeleteError('');
            try {
              await deleteSessionNote(sessionNoteDeleteTarget.sessionId, sessionNoteDeleteTarget.id);
              queryClient.setQueryData<YouthSessionNote[]>(['youth-session-notes', selectedProfileId], current => current?.filter(note => note.id !== sessionNoteDeleteTarget.id) ?? []);
              setSessionNoteDeleteTarget(null);
            } catch (error) {
              setSessionNoteDeleteError(getErrorMessage(error, 'Failed to delete session note'));
            } finally {
              setDeletingSessionNote(false);
            }
          }}>Delete</Button>
        </>}
      >
        {sessionNoteDeleteTarget && <p>Delete {sessionNoteDeleteTarget.title}? This cannot be undone.</p>}
      </Modal>
      {profileNoteTarget && selectedProfileId && (
        <ProfileNoteModal
          youthId={selectedProfileId}
          note={profileNoteTarget === 'new' ? undefined : profileNoteTarget}
          onClose={() => setProfileNoteTarget(null)}
          onSaved={note => {
            queryClient.setQueryData<YouthProfileNote[]>(['youth-profile-notes', selectedProfileId], current => {
              const rows = current ?? [];
              const index = rows.findIndex(item => item.id === note.id);
              return index === -1 ? [note, ...rows] : rows.map(item => item.id === note.id ? note : item);
            });
            setProfileNoteTarget(null);
            setSelectedProfileNote(note);
          }}
        />
      )}
      <Modal
        isOpen={selectedProfileNote !== null}
        onClose={() => {
          if (deletingProfileNote) return;
          setSelectedProfileNote(null);
          setConfirmingProfileNoteDelete(false);
          setProfileNoteDeleteError('');
        }}
        title={confirmingProfileNoteDelete ? 'Delete Profile Note' : selectedProfileNote?.title || 'Profile Note'}
        status={profileNoteDeleteError ? 'error' : deletingProfileNote ? 'submitting' : 'idle'}
        statusMessage={profileNoteDeleteError || (deletingProfileNote ? 'Deleting profile note...' : undefined)}
        disableClose={deletingProfileNote}
        footer={selectedProfileNote && canWrite ? confirmingProfileNoteDelete ? <>
          <Button variant="secondary" disabled={deletingProfileNote} onClick={() => { setConfirmingProfileNoteDelete(false); setProfileNoteDeleteError(''); }}>Cancel</Button>
          <Button variant="danger" onClick={async () => {
              setDeletingProfileNote(true);
              setProfileNoteDeleteError('');
              try {
                await deleteYouthProfileNote(selectedProfileNote.youthId, selectedProfileNote.id);
                queryClient.setQueryData<YouthProfileNote[]>(['youth-profile-notes', selectedProfileNote.youthId], current => current?.filter(note => note.id !== selectedProfileNote.id) ?? []);
                setSelectedProfileNote(null);
                setConfirmingProfileNoteDelete(false);
              } catch (error) {
                setProfileNoteDeleteError(getErrorMessage(error, 'Failed to delete profile note'));
              } finally {
                setDeletingProfileNote(false);
              }
            }} disabled={deletingProfileNote}>Delete</Button>
        </> : <>
          <Button onClick={() => { setProfileNoteTarget(selectedProfileNote); setSelectedProfileNote(null); }}>Edit</Button>
          <Button variant="danger" onClick={() => setConfirmingProfileNoteDelete(true)}>Delete</Button>
        </> : <Button variant="secondary" onClick={() => setSelectedProfileNote(null)}>Close</Button>}
      >
        {selectedProfileNote && (confirmingProfileNoteDelete
          ? <p>Delete {selectedProfileNote.title || 'this profile note'}? This cannot be undone.</p>
          : <ProfileNoteDetails note={selectedProfileNote} />)}
      </Modal>
    </>
  );
}
