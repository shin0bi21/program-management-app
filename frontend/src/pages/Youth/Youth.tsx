import { useEffect, useState, useMemo } from 'react';
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
import { getCohorts } from '../../common/api/cohorts.api';
import type { ProgramCohort, YouthSessionNote } from '../../common/types/cohort';
import { getYouthSessionNotes } from '../../common/api/youth.api';
import { STORAGE_KEYS } from '../../common/utils/storage';
import Modal from '../../common/components/Modal/Modal';
import SessionNoteDetails from '../../common/components/SessionNoteDetails/SessionNoteDetails';
import { formatShortDate } from '../../common/utils/date';
import './Youth.css';

const initialNotesTab = (): NotesTab => (
  localStorage.getItem(STORAGE_KEYS.YOUTH_NOTES_TAB) === 'session' ? 'session' : 'profile'
);

export default function Youth() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [cohortFilters, setCohortFilters] = useState<string[]>([]);
  const [cohorts, setCohorts] = useState<ProgramCohort[]>([]);
  const queryFilters = useMemo<YouthFilters>(() => ({
    search: debouncedSearch,
    programIds: programFilters,
    cohortIds: cohortFilters,
  }), [cohortFilters, debouncedSearch, programFilters]);
  const [modalTarget, setModalTarget] = useState<YouthProfile | 'new' | null>(null);
  const [contactTarget, setContactTarget] = useState<YouthProfile | null>(null);
  const [notesTab, setNotesTab] = useState<NotesTab>(initialNotesTab);
  const [sessionNotes, setSessionNotes] = useState<YouthSessionNote[]>([]);
  const [sessionNotesLoading, setSessionNotesLoading] = useState(false);
  const [sessionNotesError, setSessionNotesError] = useState<string | null>(null);
  const [selectedSessionNote, setSelectedSessionNote] = useState<YouthSessionNote | null>(null);
  const { youth, setYouth, loading, error } = useYouth(queryFilters);
  const {
    selectedItem: selectedProfile,
    selectedKey: selectedProfileId,
    selectItem: selectProfile,
  } = useTableSelection(youth);
  const { programs } = usePrograms();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:youth_profiles');

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    getCohorts(undefined, { includeAllPrograms: true }).then(setCohorts).catch(() => setCohorts([]));
  }, []);

  useEffect(() => {
    let active = true;
    setSessionNotes([]);
    setSessionNotesError(null);
    setSelectedSessionNote(null);
    if (notesTab !== 'session' || !selectedProfileId) {
      setSessionNotesLoading(false);
      return () => { active = false; };
    }

    setSessionNotesLoading(true);
    getYouthSessionNotes(selectedProfileId)
      .then(notes => {
        if (active) setSessionNotes(notes);
      })
      .catch(cause => {
        if (active) {
          setSessionNotesError(
            cause instanceof Error ? cause.message : 'Could not load session notes',
          );
        }
      })
      .finally(() => {
        if (active) setSessionNotesLoading(false);
      });
    return () => { active = false; };
  }, [notesTab, selectedProfileId]);

  const selectNotesTab = (tab: NotesTab) => {
    setNotesTab(tab);
    localStorage.setItem(STORAGE_KEYS.YOUTH_NOTES_TAB, tab);
  };

  const cohortsForPrograms = useMemo(
    () => programFilters.length
      ? cohorts.filter(cohort => programFilters.includes(cohort.programId))
      : cohorts,
    [cohorts, programFilters],
  );

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'program',
      label: 'Program',
      options: programs.map(program => ({ value: program.id, label: program.name })),
    },
    {
      id: 'cohort',
      label: 'Cohort',
      options: cohortsForPrograms.map(cohort => ({
        value: cohort.id,
        label: `${cohort.programName} · ${cohort.name}`,
      })),
    },
  ], [cohortsForPrograms, programs]);

  const handleEditProfile = (profile: YouthProfile) => setModalTarget(profile);

  const handleSaveYouth = (savedYouth: YouthProfile) => {
    setModalTarget(null);
    setContactTarget(null);
    setYouth(prev => {
      const exists = prev.some(y => y.id === savedYouth.id);
      return exists ? prev.map(y => y.id === savedYouth.id ? savedYouth : y) : [...prev, savedYouth];
    });
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
            values={{ program: programFilters, cohort: cohortFilters }}
            onApply={(category, selected) => {
              if (category === 'program') {
                setProgramFilters(selected);
                const validCohortIds = new Set(cohorts
                  .filter(cohort => !selected.length || selected.includes(cohort.programId))
                  .map(cohort => cohort.id));
                setCohortFilters(current => current.filter(id => validCohortIds.has(id)));
              }
              if (category === 'cohort') setCohortFilters(selected);
            }}
            onClearAll={() => {
              setProgramFilters([]);
              setCohortFilters([]);
            }}
          />}
        />

        <TableDetailLayout
          ariaLabel="Youth profiles"
          table={<Table ariaLabel="Youth profiles" columns={youthColumns} data={youth} loading={loading} error={error} emptyMessage={search || programFilters.length || cohortFilters.length ? 'No youth profiles match these filters' : 'No youth profiles found'} keyExtractor={profile => profile.id} selectedKey={selectedProfileId} onRowSelect={selectProfile} />}
          details={<>
            <PrimaryContactCard
              contact={selectedProfile?.contacts?.[0] ? {
                firstName: selectedProfile.contacts[0].firstName,
                lastName: selectedProfile.contacts[0].lastName,
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
              sessionNotesLoading={sessionNotesLoading}
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
