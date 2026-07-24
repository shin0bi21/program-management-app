import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../common/components/Button/Button';
import FilterCard, { type FilterCardCategory } from '../../common/components/FilterCard/FilterCard';
import FloatingSelect from '../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../common/components/FormField/FormField';
import Modal from '../../common/components/Modal/Modal';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../common/components/Table/Table';
import { getCohorts, getManagedSessions } from '../../common/api/cohorts.api';
import { useAuth } from '../../common/context/AuthContext';
import { usePrograms } from '../../common/hooks/usePrograms';
import type { ManagedSession, ProgramCohort, SessionListFilters } from '../../common/types/cohort';
import { formatShortDate } from '../../common/utils/date';
import AttendanceModal from './components/AttendanceModal';
import GenerateSessionsModal from './components/GenerateSessionsModal';
import './Sessions.css';

const timeFormatter = new Intl.DateTimeFormat('en-CA', {
  hour: 'numeric',
  minute: '2-digit',
});

type TimingFilter = 'upcoming' | 'past';

export default function Sessions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions } = useAuth();
  const { programs } = usePrograms();
  const [cohorts, setCohorts] = useState<ProgramCohort[]>([]);
  const [sessions, setSessions] = useState<ManagedSession[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<ManagedSession | null>(null);
  const [cohortPickerOpen, setCohortPickerOpen] = useState(false);
  const [scheduleCohortId, setScheduleCohortId] = useState('');
  const [generationTarget, setGenerationTarget] = useState<ProgramCohort | null>(null);
  const programId = searchParams.get('program') ?? '';
  const cohortId = searchParams.get('cohort') ?? '';
  const selectedSessionId = searchParams.get('session') ?? '';
  const timingFilters = (searchParams.get('timing') ?? '')
    .split(',')
    .filter((value): value is TimingFilter => value === 'upcoming' || value === 'past');
  const timing: NonNullable<SessionListFilters['timing']> = timingFilters.length === 1
    ? timingFilters[0]
    : 'all';
  const canWriteAttendance = permissions.includes('write:attendance');
  const canWriteCohorts = permissions.includes('write:cohorts');

  useEffect(() => {
    getCohorts().then(setCohorts).catch(() => setCohorts([]));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadSessions = () => {
    setLoading(true);
    setError(null);
    return getManagedSessions({
      programId: programId || undefined,
      cohortId: cohortId || undefined,
      timing,
      search: debouncedSearch || undefined,
    })
      .then(setSessions)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load sessions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void loadSessions();
  }, [programId, cohortId, timing, debouncedSearch]);

  const filteredCohorts = useMemo(
    () => programId ? cohorts.filter(cohort => cohort.programId === programId) : cohorts,
    [cohorts, programId],
  );
  const schedulableCohorts = useMemo(
    () => filteredCohorts.filter(cohort => cohort.state !== 'completed'),
    [filteredCohorts],
  );

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'program',
      label: 'Program',
      selectionMode: 'single',
      options: programs.map(program => ({ value: program.id, label: program.name })),
    },
    {
      id: 'cohort',
      label: 'Cohort',
      selectionMode: 'single',
      options: filteredCohorts.map(cohort => ({
        value: cohort.id,
        label: `${cohort.programName} · ${cohort.name}`,
      })),
    },
    {
      id: 'timing',
      label: 'Timing',
      options: [
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'past', label: 'Past' },
      ],
    },
  ], [filteredCohorts, programs]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'program') next.delete('cohort');
    setSearchParams(next);
  };

  const openCohortPicker = () => {
    const preferredCohort = cohortId
      ? schedulableCohorts.find(cohort => cohort.id === cohortId)
      : schedulableCohorts[0];
    setScheduleCohortId(preferredCohort?.id ?? '');
    setCohortPickerOpen(true);
  };

  const chooseCohort = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cohort = schedulableCohorts.find(candidate => candidate.id === scheduleCohortId);
    if (!cohort) return;
    setCohortPickerOpen(false);
    setGenerationTarget(cohort);
  };

  const columns = useMemo<TableColumn<ManagedSession>[]>(() => [
    { key: 'program', header: 'Program', render: session => session.programName },
    { key: 'cohort', header: 'Cohort', render: session => session.cohortName },
    { key: 'activity', header: 'Session', render: session => session.activityName },
    { key: 'focus', header: 'Focus', render: session => session.focus || '—' },
    { key: 'date', header: 'Date', width: '135px', render: session => formatShortDate(session.startsAt) },
    {
      key: 'time',
      header: 'Time',
      width: '165px',
      render: session => `${timeFormatter.format(new Date(session.startsAt))} – ${timeFormatter.format(new Date(session.endsAt))}`,
    },
    {
      key: 'attendance',
      header: 'Attendance',
      width: '150px',
      render: session => session.attendanceRate === null
        ? 'Not taken'
        : `${session.attendedCount}/${session.attendanceMarkedCount} · ${session.attendanceRate}%`,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: session => <span className={`session-state session-state--${session.state}`}>{session.state}</span>,
    },
    ...(canWriteAttendance ? [{
      key: 'actions',
      header: '',
      className: 'col-actions',
      render: (session: ManagedSession) => <ActionsMenu
        ariaLabel={`More actions for ${session.focus || session.activityName}`}
        items={[{
          id: 'attendance',
          label: 'Take Attendance',
          onClick: () => setAttendanceTarget(session),
        }]}
      />,
    }] : []),
  ], [canWriteAttendance]);

  return (
    <div className="sessions-page">
      <PageHeader
        title="Sessions"
        actions={canWriteCohorts ? (
          <Button onClick={openCohortPicker} disabled={!schedulableCohorts.length}>
            + Add Sessions
          </Button>
        ) : undefined}
        search={<SearchInput
          label="Search sessions"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search sessions, focuses, or cohorts"
        />}
        filters={<FilterCard
          categories={filterCategories}
          values={{
            program: programId ? [programId] : [],
            cohort: cohortId ? [cohortId] : [],
            timing: timingFilters,
          }}
          onApply={(category, selected) => setFilter(
            category,
            category === 'timing' ? selected.join(',') : selected[0] ?? '',
          )}
          onClearAll={() => setSearchParams({})}
        />}
      />
      <Table
        ariaLabel="Sessions"
        columns={columns}
        data={sessions}
        loading={loading}
        error={error ?? undefined}
        keyExtractor={session => session.id}
        selectedKey={selectedSessionId || null}
        scrollToSelected={Boolean(selectedSessionId)}
        emptyMessage={search || programId || cohortId || timingFilters.length
          ? 'No sessions match your search and filters'
          : 'No sessions yet'}
      />
      <AttendanceModal
        session={attendanceTarget}
        onClose={() => setAttendanceTarget(null)}
        onSaved={loadSessions}
      />
      <Modal
        isOpen={cohortPickerOpen}
        onClose={() => setCohortPickerOpen(false)}
        title="Add sessions"
        maxWidth="520px"
        footer={<>
          <Button variant="secondary" onClick={() => setCohortPickerOpen(false)}>Cancel</Button>
          <Button type="submit" form="choose-session-cohort" disabled={!scheduleCohortId}>Continue</Button>
        </>}
      >
        <form id="choose-session-cohort" onSubmit={chooseCohort}>
          <FormField id="session-cohort" label="Cohort">
            <FloatingSelect
              id="session-cohort"
              value={scheduleCohortId}
              onChange={setScheduleCohortId}
              placeholder="Choose a cohort"
              options={schedulableCohorts.map(cohort => ({
                value: cohort.id,
                label: `${cohort.programName} · ${cohort.name}`,
              }))}
            />
          </FormField>
        </form>
      </Modal>
      <GenerateSessionsModal
        cohort={generationTarget}
        onClose={() => setGenerationTarget(null)}
        onSuccess={async () => {
          await Promise.all([
            loadSessions(),
            getCohorts().then(setCohorts),
          ]);
        }}
      />
    </div>
  );
}
