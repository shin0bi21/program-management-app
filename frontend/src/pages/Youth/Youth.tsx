import { useEffect, useState, useMemo } from 'react';
import Button from '../../common/components/Button/Button';
import Table, { TableColumn } from '../../common/components/Table/Table';
import TableDetailLayout from '../../common/components/TableDetailLayout/TableDetailLayout';
import {
  AttendanceCard,
  NotesCard,
  PrimaryContactCard,
} from '../../common/components/DetailCards/DetailCards';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import FilterCard, { type FilterCardCategory } from '../../common/components/FilterCard/FilterCard';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import { useYouth, YouthProfile } from './hooks/useYouth';
import YouthModal from './components/YouthModal/YouthModal';
import ManageCohortsModal from './components/ManageCohortsModal/ManageCohortsModal';
import { useAuth } from '../../common/context/AuthContext';
import { calculateAge } from '../../common/utils/time';
import { usePrograms } from '../../common/hooks/usePrograms';
import useTableSelection from '../../common/hooks/useTableSelection';
import type { YouthFilters } from '../../common/types/youth';
import { getCohorts } from '../../common/api/cohorts.api';
import type { ProgramCohort } from '../../common/types/cohort';
import './Youth.css';

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
  const [manageCohortsYouthId, setManageCohortsYouthId] = useState<string | null>(null);
  const { youth, setYouth, loading, error, refetch } = useYouth(queryFilters);
  const {
    selectedItem: selectedProfile,
    selectedKey: selectedProfileId,
    selectItem: selectProfile,
  } = useTableSelection(youth);
  const { programs } = usePrograms();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:youth_profiles');
  const canManageCohorts = permissions.includes('write:cohorts');

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    getCohorts(undefined, { includeAllPrograms: true }).then(setCohorts).catch(() => setCohorts([]));
  }, []);

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
      render: (profile) => canWrite || canManageCohorts ? (
        <ActionsMenu
          ariaLabel={`More actions for ${profile.firstName} ${profile.lastName}`}
          items={[
            ...(canWrite ? [{ id: 'edit', label: 'Edit', onClick: () => handleEditProfile(profile) }] : []),
            ...(canManageCohorts ? [{
              id: 'manage-cohorts',
              label: 'Manage Cohorts',
              onClick: () => setManageCohortsYouthId(profile.id),
            }] : []),
          ]}
        />
      ) : null,
    },
  ], [canManageCohorts, canWrite]);

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
                  aria-label="Add primary contact"
                  onClick={() => {
                    if (selectedProfile) setContactTarget(selectedProfile);
                  }}
                >
                  + Add
                </Button>
              ) : undefined}
            />
            <AttendanceCard
              cohorts={selectedProfile?.cohorts}
              selected={selectedProfile !== null}
            />
            <NotesCard notes={selectedProfile?.notes} selected={selectedProfile !== null} />
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

      <ManageCohortsModal
        youth={youth.find(profile => profile.id === manageCohortsYouthId) ?? null}
        onClose={() => setManageCohortsYouthId(null)}
        onChanged={refetch}
      />
    </>
  );
}
