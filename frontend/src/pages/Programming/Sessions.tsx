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
import { deleteSession, getCohorts, getManagedSessions, updateSession } from '../../common/api/cohorts.api';
import { useAuth } from '../../common/context/AuthContext';
import { usePrograms } from '../../common/hooks/usePrograms';
import { useConfirmModal, type ConfirmAction } from '../../common/hooks/useConfirmModal';
import type { SubmitStatus } from '../../common/hooks/useSubmitStatus';
import type { ManagedSession, ProgramCohort, SessionListFilters } from '../../common/types/cohort';
import { formatShortDate } from '../../common/utils/date';
import AttendanceModal from './components/AttendanceModal';
import GenerateSessionsModal from './components/GenerateSessionsModal';
import './Sessions.css';

const timeFormatter = new Intl.DateTimeFormat('en-CA', {
  hour: 'numeric',
  minute: '2-digit',
});
const localDateTime = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

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
  const [editTarget, setEditTarget] = useState<ManagedSession | null>(null);
  const [editStatus, setEditStatus] = useState<SubmitStatus>('idle');
  const [editMessage, setEditMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
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
    { key: 'theme', header: 'Theme', render: session => session.theme },
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
      render: session => session.rosterMode === 'open'
        ? (session.attendanceMarkedCount ? `${session.attendanceMarkedCount} attended` : 'No check-ins')
        : session.attendanceRate === null
          ? 'Not taken'
          : `${session.attendedCount}/${session.attendanceMarkedCount} · ${session.attendanceRate}%`,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: session => <span className={`session-state session-state--${session.state}`}>{session.state}</span>,
    },
    ...(canWriteAttendance || canWriteCohorts ? [{
      key: 'actions',
      header: '',
      className: 'col-actions',
      render: (session: ManagedSession) => <ActionsMenu
        ariaLabel={`More actions for ${session.theme}`}
        items={[
          ...(canWriteAttendance ? [{
            id: 'attendance', label: 'Take Attendance', onClick: () => setAttendanceTarget(session),
          }] : []),
          ...(canWriteCohorts ? [
            { id: 'edit', label: 'Edit Session', onClick: () => { setEditStatus('idle'); setEditMessage(''); setEditTarget(session); } },
            {
              id: 'delete', label: 'Delete Session', variant: 'danger' as const, onClick: () => setConfirmAction({
                title: 'Delete Session',
                message: `Delete ${session.theme}? This cannot be undone.`,
                confirmLabel: 'Delete',
                confirmVariant: 'danger',
                successMessage: 'Session deleted',
                onConfirm: async () => { await deleteSession(session.id); await loadSessions(); },
              }),
            },
          ] : []),
        ]}
      />,
    }] : []),
  ], [canWriteAttendance, canWriteCohorts, programId, cohortId, timing, debouncedSearch]);

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTarget) return;
    const form = new FormData(event.currentTarget);
    setEditStatus('submitting');
    setEditMessage('Updating session...');
    try {
      await updateSession(editTarget.id, {
        theme: String(form.get('theme')),
        startsAt: new Date(String(form.get('startsAt'))).toISOString(),
        endsAt: new Date(String(form.get('endsAt'))).toISOString(),
        description: String(form.get('description')).trim() || null,
      });
      await loadSessions();
      setEditMessage('Session updated successfully.');
      setEditStatus('success');
    } catch (cause) {
      setEditMessage(cause instanceof Error ? cause.message : 'Could not update session');
      setEditStatus('error');
    }
  };
  const editComplete = editStatus === 'submitting' || editStatus === 'success';

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
          placeholder="Search themes, descriptions, or cohorts"
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
        isOpen={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Edit session"
        status={editStatus}
        statusMessage={editMessage}
        successDelay={1200}
        footer={<>
          <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={editComplete}>Cancel</Button>
          <Button type="submit" form="edit-session-form" disabled={editComplete}>Save Changes</Button>
        </>}
      >
        {editTarget && <form id="edit-session-form" onSubmit={submitEdit}>
          <FormField id="edit-session-theme" label="Theme">
            <input id="edit-session-theme" name="theme" required defaultValue={editTarget.theme} maxLength={160} />
          </FormField>
          <div className="form-row edit-session-time-row">
            <FormField id="edit-session-start" label="Starts at">
              <input id="edit-session-start" name="startsAt" type="datetime-local" required defaultValue={localDateTime(editTarget.startsAt)} />
            </FormField>
            <FormField id="edit-session-end" label="Ends at">
              <input id="edit-session-end" name="endsAt" type="datetime-local" required defaultValue={localDateTime(editTarget.endsAt)} />
            </FormField>
          </div>
          <FormField id="edit-session-description" label="Description">
            <textarea id="edit-session-description" name="description" defaultValue={editTarget.description ?? ''} maxLength={5000} />
          </FormField>
        </form>}
      </Modal>
      <Modal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        status={confirmModal.status}
        statusMessage={confirmModal.statusMessage}
        footer={confirmModal.footer}
        disableClose={confirmModal.disableClose}
        successDelay={confirmModal.successDelay}
      >
        {confirmAction && <p>{confirmAction.message}</p>}
      </Modal>
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
