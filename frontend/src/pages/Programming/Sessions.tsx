import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../common/components/Button/Button';
import FilterCard, { type FilterCardCategory } from '../../common/components/FilterCard/FilterCard';
import FormField from '../../common/components/FormField/FormField';
import Modal from '../../common/components/Modal/Modal';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../common/components/Table/Table';
import TableDetailLayout from '../../common/components/TableDetailLayout/TableDetailLayout';
import { deleteSession, getCohorts, getManagedSessions, updateSession } from '../../common/api/cohorts.api';
import { useAuth } from '../../common/context/AuthContext';
import { usePrograms } from '../../common/hooks/usePrograms';
import { useConfirmModal, type ConfirmAction } from '../../common/hooks/useConfirmModal';
import type { SubmitStatus } from '../../common/hooks/useSubmitStatus';
import type { CohortSession, ManagedSession, ProgramCohort } from '../../common/types/cohort';
import { formatShortDate } from '../../common/utils/date';
import AttendanceModal from './components/AttendanceModal';
import GenerateSessionsModal from './components/GenerateSessionsModal';
import SessionOverview from './components/SessionOverview/SessionOverview';
import SessionsCalendarView from './components/SessionsCalendarView/SessionsCalendarView';
import './Sessions.css';

const timeFormatter = new Intl.DateTimeFormat('en-CA', {
  hour: 'numeric',
  minute: '2-digit',
});
const localDateTime = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

type StatusFilter = 'upcoming' | 'completed';
type SessionsView = 'list' | 'calendar';

export default function Sessions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions } = useAuth();
  const { programs } = usePrograms({ assignedOnly: true });
  const [cohorts, setCohorts] = useState<ProgramCohort[]>([]);
  const [sessions, setSessions] = useState<ManagedSession[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<CohortSession | null>(null);
  const [addSessionsOpen, setAddSessionsOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedSession | null>(null);
  const [editStatus, setEditStatus] = useState<SubmitStatus>('idle');
  const [editMessage, setEditMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const view: SessionsView = searchParams.get('view') === 'calendar' ? 'calendar' : 'list';
  const programFilter = searchParams.get('program') ?? '';
  const selectedProgramIds = useMemo(
    () => programFilter.split(',').filter(Boolean),
    [programFilter],
  );
  const cohortId = searchParams.get('cohort') ?? '';
  const selectedSessionId = searchParams.get('session') ?? '';
  const statusFilter = searchParams.get('status') ?? '';
  const statusFilters = useMemo(
    () => statusFilter
      .split(',')
      .filter((value): value is StatusFilter => value === 'upcoming' || value === 'completed'),
    [statusFilter],
  );
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
      programIds: selectedProgramIds,
      cohortId: cohortId || undefined,
      statuses: statusFilters,
      search: debouncedSearch || undefined,
    })
      .then(setSessions)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load sessions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void loadSessions();
  }, [selectedProgramIds.join(','), cohortId, statusFilters.join(','), debouncedSearch]);

  const filteredCohorts = useMemo(
    () => selectedProgramIds.length
      ? cohorts.filter(cohort => selectedProgramIds.includes(cohort.programId))
      : cohorts,
    [cohorts, selectedProgramIds.join(',')],
  );
  const schedulableCohorts = useMemo(
    () => filteredCohorts.filter(cohort => cohort.state !== 'completed'),
    [filteredCohorts],
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
      selectionMode: 'single',
      options: filteredCohorts.map(cohort => ({
        value: cohort.id,
        label: `${cohort.programName} · ${cohort.name}`,
      })),
    },
    {
      id: 'status',
      label: 'Status',
      options: [
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'completed', label: 'Completed' },
      ],
    },
  ], [filteredCohorts, programs]);

  const setFilter = (key: string, values: string[]) => {
    const next = new URLSearchParams(searchParams);
    if (values.length) next.set(key, values.join(','));
    else next.delete(key);
    if (key === 'program') next.delete('cohort');
    next.delete('session');
    setSearchParams(next);
  };

  const setView = (nextView: SessionsView) => {
    const next = new URLSearchParams(searchParams);
    if (nextView === 'calendar') next.set('view', 'calendar');
    else next.delete('view');
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchParams(view === 'calendar' ? { view: 'calendar' } : {});
  };

  const selectSession = (session: Pick<CohortSession, 'id'>) => {
    const next = new URLSearchParams(searchParams);
    next.set('session', session.id);
    setSearchParams(next);
  };

  const columns = useMemo<TableColumn<ManagedSession>[]>(() => [
    { key: 'program', header: 'Program', render: session => session.programName },
    { key: 'cohort', header: 'Cohort', render: session => session.cohortName },
    { key: 'theme', header: 'Theme', render: session => session.theme || '—' },
    { key: 'date', header: 'Date', width: '135px', render: session => formatShortDate(session.startsAt) },
    {
      key: 'time',
      header: 'Time',
      width: '165px',
      render: session => `${timeFormatter.format(new Date(session.startsAt))} – ${timeFormatter.format(new Date(session.endsAt))}`,
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
        ariaLabel={`More actions for ${session.theme || `${session.programName} session`}`}
        items={[
          ...(canWriteAttendance ? [{
            id: 'attendance', label: 'Take Attendance', onClick: () => setAttendanceTarget(session),
          }] : []),
          ...(canWriteCohorts ? [
            { id: 'edit', label: 'Edit Session', onClick: () => { setEditStatus('idle'); setEditMessage(''); setEditTarget(session); } },
            {
              id: 'delete', label: 'Delete Session', variant: 'danger' as const, onClick: () => setConfirmAction({
                title: 'Delete Session',
                message: `Delete ${session.theme || `${session.programName} session`}? This cannot be undone.`,
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
  ], [canWriteAttendance, canWriteCohorts, selectedProgramIds.join(','), cohortId, statusFilters.join(','), debouncedSearch]);

  const selectedSession = useMemo(
    () => sessions.find(session => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  );

  const refreshActiveView = async () => {
    await loadSessions();
    if (view === 'calendar') setCalendarRefreshToken(current => current + 1);
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTarget) return;
    const form = new FormData(event.currentTarget);
    setEditStatus('submitting');
    setEditMessage('Updating session...');
    try {
      await updateSession(editTarget.id, {
        theme: String(form.get('theme')).trim() || null,
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
    <div className={`sessions-page data-detail-page-content${view === 'calendar' ? ' sessions-page--calendar' : ''}`}>
      <PageHeader
        title="Sessions"
        actions={canWriteCohorts ? (
          <Button onClick={() => setAddSessionsOpen(true)} disabled={!schedulableCohorts.length}>
            + Add
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
            program: selectedProgramIds,
            cohort: cohortId ? [cohortId] : [],
            status: statusFilters,
          }}
          onApply={(category, selected) => setFilter(
            category,
            category === 'cohort' ? selected.slice(0, 1) : selected,
          )}
          onClearAll={clearFilters}
        />}
      />
      <div className="sessions-view-row">
        <div className="sessions-view-toggle" role="group" aria-label="Session view">
          <Button
            size="sm"
            variant={view === 'list' ? 'primary' : 'secondary'}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            List
          </Button>
          <Button
            size="sm"
            variant={view === 'calendar' ? 'primary' : 'secondary'}
            aria-pressed={view === 'calendar'}
            onClick={() => setView('calendar')}
          >
            Calendar
          </Button>
        </div>
      </div>
      {view === 'list' ? (
        <TableDetailLayout
          ariaLabel="Sessions and overview"
          table={<Table
            ariaLabel="Sessions"
            columns={columns}
            data={sessions}
            loading={loading}
            error={error ?? undefined}
            keyExtractor={session => session.id}
            selectedKey={selectedSessionId || null}
            scrollToSelected={Boolean(selectedSessionId)}
            onRowSelect={selectSession}
            emptyMessage={search || selectedProgramIds.length || cohortId || statusFilters.length
              ? 'No sessions match your search and filters'
              : 'No sessions yet'}
          />}
          details={(
            <SessionOverview
              session={selectedSession}
              canWriteAttendance={canWriteAttendance}
              canWriteNotes={canWriteCohorts}
              onAddAttendance={setAttendanceTarget}
            />
          )}
        />
      ) : (
        <TableDetailLayout
          ariaLabel="Sessions calendar and overview"
          table={(
            <SessionsCalendarView
              selectedProgramIds={selectedProgramIds}
              selectedCohortId={cohortId}
              selectedSessionId={selectedSessionId}
              selectedStatuses={statusFilters}
              search={debouncedSearch}
              refreshToken={calendarRefreshToken}
              onSessionSelect={selectSession}
            />
          )}
          details={(
            <SessionOverview
              session={selectedSession}
              canWriteAttendance={canWriteAttendance}
              canWriteNotes={canWriteCohorts}
              onAddAttendance={setAttendanceTarget}
            />
          )}
        />
      )}
      <AttendanceModal
        session={attendanceTarget}
        onClose={() => setAttendanceTarget(null)}
        onSaved={refreshActiveView}
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
          <FormField id="edit-session-theme" label="Theme (optional)">
            <input id="edit-session-theme" name="theme" defaultValue={editTarget.theme ?? ''} maxLength={160} />
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
      <GenerateSessionsModal
        cohort={null}
        cohorts={schedulableCohorts}
        isOpen={addSessionsOpen}
        initialCohortId={cohortId || schedulableCohorts[0]?.id}
        onClose={() => setAddSessionsOpen(false)}
        onSuccess={async () => {
          await Promise.all([
            refreshActiveView(),
            getCohorts().then(setCohorts),
          ]);
        }}
      />
    </div>
  );
}
