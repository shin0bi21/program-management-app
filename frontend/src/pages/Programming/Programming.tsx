import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../common/components/Button/Button';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import FilterCard, { type FilterCardCategory } from '../../common/components/FilterCard/FilterCard';
import FloatingMenuPanel from '../../common/components/FloatingMenuPanel/FloatingMenuPanel';
import FloatingSelect from '../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../common/components/FormField/FormField';
import Modal from '../../common/components/Modal/Modal';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../common/components/Table/Table';
import TableDetailLayout from '../../common/components/TableDetailLayout/TableDetailLayout';
import { DashboardCard } from '../../common/components/DashboardCard/DashboardCard';
import { createCohort, deleteCohort, getCohorts, updateCohort } from '../../common/api/cohorts.api';
import { createProgram } from '../../common/api/programs.api';
import { useAuth } from '../../common/context/AuthContext';
import { useFloatingMenu } from '../../common/hooks/useFloatingMenu';
import { usePrograms } from '../../common/hooks/usePrograms';
import type { SubmitStatus } from '../../common/hooks/useSubmitStatus';
import useTableSelection from '../../common/hooks/useTableSelection';
import { useConfirmModal, type ConfirmAction } from '../../common/hooks/useConfirmModal';
import type { ProgramCohort } from '../../common/types/cohort';
import { formatShortDate } from '../../common/utils/date';
import EnrollYouthModal from './components/EnrollYouthModal';
import GenerateSessionsModal from './components/GenerateSessionsModal';

export default function Programming() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions } = useAuth();
  const canWritePrograms = permissions.includes('write:programs');
  const canWriteCohorts = permissions.includes('write:cohorts');
  const { programs, setPrograms, error: programsError } = usePrograms({ assignedOnly: true });
  const selectedProgramId = searchParams.get('program') ?? '';
  const selectedStatus = searchParams.get('status') ?? '';
  const [cohorts, setCohorts] = useState<ProgramCohort[]>([]);
  const [cohortsLoading, setCohortsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [cohortProgramId, setCohortProgramId] = useState('');
  const [enrollTarget, setEnrollTarget] = useState<ProgramCohort | null>(null);
  const [generationTarget, setGenerationTarget] = useState<ProgramCohort | null>(null);
  const [programSubmitStatus, setProgramSubmitStatus] = useState<SubmitStatus>('idle');
  const [programStatusMessage, setProgramStatusMessage] = useState('');
  const [programRosterMode, setProgramRosterMode] = useState<'enrolled' | 'open'>('enrolled');
  const [cohortSubmitStatus, setCohortSubmitStatus] = useState<SubmitStatus>('idle');
  const [cohortStatusMessage, setCohortStatusMessage] = useState('');
  const [editCohortTarget, setEditCohortTarget] = useState<ProgramCohort | null>(null);
  const [editCohortStatus, setEditCohortStatus] = useState<SubmitStatus>('idle');
  const [editCohortMessage, setEditCohortMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const {
    isOpen: addMenuOpen,
    toggle: toggleAddMenu,
    close: closeAddMenu,
    position: addMenuPosition,
    menuRef: addMenuRef,
  } = useFloatingMenu(
    addButtonRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 180, heightEstimate: 100 },
  );

  useEffect(() => {
    let active = true;
    setCohortsLoading(true);
    setError(null);
    getCohorts(selectedProgramId || undefined)
      .then(data => { if (active) setCohorts(data); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load cohorts'); })
      .finally(() => { if (active) setCohortsLoading(false); });
    return () => { active = false; };
  }, [selectedProgramId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const visibleCohorts = useMemo(
    () => cohorts.filter(cohort => {
      if (selectedStatus && cohort.state !== selectedStatus) return false;
      if (!debouncedSearch) return true;
      return cohort.name.toLowerCase().includes(debouncedSearch)
        || cohort.programName.toLowerCase().includes(debouncedSearch);
    }),
    [cohorts, debouncedSearch, selectedStatus],
  );
  const {
    selectedItem: selectedCohort,
    selectedKey: selectedCohortId,
    selectItem: selectCohort,
  } = useTableSelection(visibleCohorts);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'program',
      label: 'Program',
      selectionMode: 'single',
      options: programs.map(program => ({ value: program.id, label: program.name })),
    },
    {
      id: 'status',
      label: 'Status',
      selectionMode: 'single',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'completed', label: 'Completed' },
      ],
    },
  ], [programs]);

  const columns = useMemo<TableColumn<ProgramCohort>[]>(() => [
    { key: 'program', header: 'Program', render: cohort => cohort.programName },
    { key: 'cohort', header: 'Cohort', render: cohort => cohort.name },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: cohort => (
        <span className={`cohort-state cohort-state--${cohort.state}`}>{cohort.state}</span>
      ),
    },
    { key: 'start', header: 'Start', width: '140px', render: cohort => formatShortDate(cohort.startsOn) },
    { key: 'end', header: 'End', width: '140px', render: cohort => formatShortDate(cohort.endsOn) },
    {
      key: 'youth',
      header: 'Youth',
      width: '120px',
      render: cohort => cohort.rosterMode === 'open'
        ? cohort.uniqueAttendeeCount
        : cohort.enrolledCount,
    },
    ...(canWriteCohorts ? [{
      key: 'actions',
      header: '',
      className: 'col-actions',
      render: (cohort: ProgramCohort) => <ActionsMenu
        ariaLabel={`More actions for ${cohort.name}`}
        items={[
          ...(cohort.rosterMode === 'enrolled'
            ? [{ id: 'enroll', label: 'Enroll Youth', onClick: () => setEnrollTarget(cohort) }]
            : []),
          { id: 'add-sessions', label: 'Add Sessions', onClick: () => setGenerationTarget(cohort) },
          { id: 'edit', label: 'Edit Cohort', onClick: () => { setEditCohortStatus('idle'); setEditCohortMessage(''); setEditCohortTarget(cohort); } },
          {
            id: 'delete', label: 'Delete Cohort', variant: 'danger' as const, onClick: () => setConfirmAction({
              title: 'Delete Cohort',
              message: `Delete ${cohort.programName} · ${cohort.name}? Its sessions and enrollments will also be deleted. Cohorts with attendance cannot be deleted.`,
              confirmLabel: 'Delete',
              confirmVariant: 'danger',
              successMessage: 'Cohort deleted',
              onConfirm: async () => {
                await deleteCohort(cohort.id);
                setCohorts(await getCohorts(selectedProgramId || undefined));
              },
            }),
          },
        ]}
      />,
    }] : []),
  ], [canWriteCohorts, selectedProgramId]);

  const selectProgram = (programId: string) => {
    const next = new URLSearchParams(searchParams);
    if (programId) next.set('program', programId);
    else next.delete('program');
    setSearchParams(next);
  };

  const selectStatus = (status: string) => {
    const next = new URLSearchParams(searchParams);
    if (status) next.set('status', status);
    else next.delete('status');
    setSearchParams(next);
  };

  const submitProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const programName = String(form.get('name'));
    setProgramSubmitStatus('submitting');
    setProgramStatusMessage(`Adding ${programName}...`);
    try {
      const program = await createProgram({
        name: programName,
        description: String(form.get('description')).trim() || null,
        rosterMode: programRosterMode,
        minAge: form.get('minAge') ? Number(form.get('minAge')) : null,
        maxAge: form.get('maxAge') ? Number(form.get('maxAge')) : null,
      });
      setPrograms(current => [...current, program].sort((a, b) => a.name.localeCompare(b.name)));
      selectProgram(program.id);
      setProgramStatusMessage(`${program.name} successfully added.`);
      setProgramSubmitStatus('success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not create program';
      setProgramStatusMessage(message);
      setProgramSubmitStatus('error');
    }
  };

  const submitCohort = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cohortName = String(form.get('name'));
    const programName = programs.find(program => program.id === cohortProgramId)?.name ?? 'program';
    setCohortSubmitStatus('submitting');
    setCohortStatusMessage(`Adding ${cohortName} to ${programName}...`);
    try {
      await createCohort({
        programId: cohortProgramId,
        name: cohortName,
        startsOn: String(form.get('startsOn')),
        endsOn: String(form.get('endsOn')),
      });
      setCohorts(await getCohorts(selectedProgramId || undefined));
      setCohortStatusMessage(`${cohortName} successfully added to ${programName}.`);
      setCohortSubmitStatus('success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not create cohort';
      setCohortStatusMessage(message);
      setCohortSubmitStatus('error');
    }
  };

  const submitCohortEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editCohortTarget) return;
    const form = new FormData(event.currentTarget);
    setEditCohortStatus('submitting');
    setEditCohortMessage('Updating cohort...');
    try {
      await updateCohort(editCohortTarget.id, {
        name: String(form.get('name')),
        startsOn: String(form.get('startsOn')),
        endsOn: String(form.get('endsOn')),
      });
      setCohorts(await getCohorts(selectedProgramId || undefined));
      setEditCohortMessage('Cohort updated successfully.');
      setEditCohortStatus('success');
    } catch (cause) {
      setEditCohortMessage(cause instanceof Error ? cause.message : 'Could not update cohort');
      setEditCohortStatus('error');
    }
  };
  const editCohortComplete = editCohortStatus === 'submitting' || editCohortStatus === 'success';
  const openProgramModal = () => {
    closeAddMenu();
    setProgramSubmitStatus('idle');
    setProgramStatusMessage('');
    setProgramRosterMode('enrolled');
    setProgramModalOpen(true);
  };
  const openCohortModal = () => {
    closeAddMenu();
    setCohortProgramId(selectedProgramId || programs[0]?.id || '');
    setCohortSubmitStatus('idle');
    setCohortStatusMessage('');
    setCohortModalOpen(true);
  };

  return (
    <div className="programming-page data-detail-page-content">
      <PageHeader
        title="Cohorts"
        actions={canWritePrograms ? <>
          <Button
            ref={addButtonRef}
            aria-haspopup="menu"
            aria-expanded={addMenuOpen}
            onClick={toggleAddMenu}
          >
            + Add
          </Button>
          {addMenuPosition && (
            <FloatingMenuPanel
              menuRef={addMenuRef}
              position={addMenuPosition}
              onClose={closeAddMenu}
              width={180}
            >
              <button
                type="button"
                role="menuitem"
                onClick={openProgramModal}
              >
                Add Program
              </button>
              {canWriteCohorts && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={!programs.length}
                  onClick={openCohortModal}
                >
                  Add Cohort
                </button>
              )}
            </FloatingMenuPanel>
          )}
        </> : canWriteCohorts ? (
          <Button onClick={openCohortModal} disabled={!programs.length}>
            + Add
          </Button>
        ) : undefined}
        search={<SearchInput
          label="Search cohorts"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search cohorts or programs"
        />}
        filters={<FilterCard
          categories={filterCategories}
          values={{
            program: selectedProgramId ? [selectedProgramId] : [],
            status: selectedStatus ? [selectedStatus] : [],
          }}
          onApply={(category, selected) => {
            if (category === 'program') selectProgram(selected[0] ?? '');
            if (category === 'status') selectStatus(selected[0] ?? '');
          }}
          onClearAll={() => setSearchParams({})}
        />}
      />

      {programsError && <p className="programming-error">{programsError}</p>}
      <TableDetailLayout
        ariaLabel="Programming cohorts and overview"
        table={<Table
          ariaLabel="Cohorts"
          columns={columns}
          data={visibleCohorts}
          loading={cohortsLoading}
          error={error ?? undefined}
          keyExtractor={cohort => cohort.id}
          selectedKey={selectedCohortId}
          onRowSelect={selectCohort}
          emptyMessage={selectedProgramId || selectedStatus || debouncedSearch
            ? 'No cohorts match your search and filters'
            : 'No cohorts yet'}
        />}
        details={<>
          <DashboardCard
            title="Youth enrolled"
            emptyMessage="No cohort selected."
            action={!selectedCohort || selectedCohort.rosterMode === 'enrolled' ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={!selectedCohort}
                aria-label="Enroll youth"
                onClick={() => {
                  if (selectedCohort) setEnrollTarget(selectedCohort);
                }}
              >
                + Add
              </Button>
            ) : undefined}
          >
            {selectedCohort
              ? <strong className="dashboard-card__metric">
                  {selectedCohort.enrolledCount}
                </strong>
              : undefined}
          </DashboardCard>
          <DashboardCard title="Next session" emptyMessage="No cohort selected.">
            {selectedCohort ? (
              <div className="dashboard-card__metric-row">
                <strong className="dashboard-card__metric">{selectedCohort.nextSessionAt
                  ? formatShortDate(selectedCohort.nextSessionAt)
                  : 'None'}</strong>
                {selectedCohort.nextSessionId && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/programming/sessions?session=${selectedCohort.nextSessionId}`)}
                  >
                    Go to
                  </Button>
                )}
              </div>
            ) : undefined}
          </DashboardCard>
          <DashboardCard
            title="Average attendance"
            emptyMessage="No cohort selected."
          >
            {selectedCohort
              ? <strong className="dashboard-card__metric">
                  {selectedCohort.averageAttendance === null
                    ? '—'
                    : `${selectedCohort.averageAttendance}%`}
                </strong>
              : undefined}
          </DashboardCard>
        </>}
      />

      <Modal
        isOpen={programModalOpen}
        onClose={() => setProgramModalOpen(false)}
        title="Add program"
        status={programSubmitStatus}
        statusMessage={programStatusMessage}
        successDelay={1400}
        disableClose={programSubmitStatus === 'submitting'}
        footer={<>
          <Button
            variant="secondary"
            onClick={() => setProgramModalOpen(false)}
            disabled={programSubmitStatus === 'submitting' || programSubmitStatus === 'success'}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-program-form"
            disabled={programSubmitStatus === 'submitting' || programSubmitStatus === 'success'}
          >
            Add Program
          </Button>
        </>}
      >
        <form id="add-program-form" onSubmit={event => void submitProgram(event)}>
          <FormField id="program-name" label="Program name">
            <input id="program-name" name="name" required maxLength={120} />
          </FormField>
          <FormField id="program-description" label="Description">
            <textarea id="program-description" name="description" rows={4} maxLength={2000} />
          </FormField>
          <div className="form-row">
            <FormField id="program-min-age" label="Minimum age">
              <input id="program-min-age" name="minAge" type="number" min={0} max={30} />
            </FormField>
            <FormField id="program-max-age" label="Maximum age">
              <input id="program-max-age" name="maxAge" type="number" min={0} max={30} />
            </FormField>
          </div>
          <FormField id="program-roster-mode" label="Attendance">
            <FloatingSelect
              id="program-roster-mode"
              value={programRosterMode}
              onChange={value => setProgramRosterMode(value as 'enrolled' | 'open')}
              options={[
                { value: 'enrolled', label: 'Enrollment required' },
                { value: 'open', label: 'Open attendance' },
              ]}
            />
          </FormField>
        </form>
      </Modal>

      <Modal
        isOpen={cohortModalOpen}
        onClose={() => setCohortModalOpen(false)}
        title="Add cohort"
        status={cohortSubmitStatus}
        statusMessage={cohortStatusMessage}
        successDelay={1400}
        disableClose={cohortSubmitStatus === 'submitting'}
        footer={<>
          <Button
            variant="secondary"
            onClick={() => setCohortModalOpen(false)}
            disabled={cohortSubmitStatus === 'submitting' || cohortSubmitStatus === 'success'}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-cohort-form"
            disabled={cohortSubmitStatus === 'submitting' || cohortSubmitStatus === 'success'}
          >
            Add Cohort
          </Button>
        </>}
      >
        <form id="add-cohort-form" onSubmit={event => void submitCohort(event)}>
          <FormField id="cohort-program" label="Program">
            <FloatingSelect
              id="cohort-program"
              value={cohortProgramId}
              options={programs.map(program => ({ value: program.id, label: program.name }))}
              onChange={setCohortProgramId}
              placeholder="Choose a program"
            />
          </FormField>
          <FormField id="cohort-name" label="Cohort name">
            <input id="cohort-name" name="name" required maxLength={120} placeholder="Fall 2026" />
          </FormField>
          <div className="form-row">
            <FormField id="cohort-start" label="Starts on">
              <input id="cohort-start" name="startsOn" type="date" required />
            </FormField>
            <FormField id="cohort-end" label="Ends on">
              <input id="cohort-end" name="endsOn" type="date" required />
            </FormField>
          </div>
        </form>
      </Modal>

      <EnrollYouthModal
        cohort={enrollTarget}
        onClose={() => setEnrollTarget(null)}
        onSuccess={async () => {
          setCohorts(await getCohorts(selectedProgramId || undefined));
        }}
      />
      <Modal
        isOpen={editCohortTarget !== null}
        onClose={() => setEditCohortTarget(null)}
        title="Edit cohort"
        status={editCohortStatus}
        statusMessage={editCohortMessage}
        successDelay={1200}
        footer={<>
          <Button variant="secondary" onClick={() => setEditCohortTarget(null)} disabled={editCohortComplete}>Cancel</Button>
          <Button type="submit" form="edit-cohort-form" disabled={editCohortComplete}>Save Changes</Button>
        </>}
      >
        {editCohortTarget && <form id="edit-cohort-form" onSubmit={submitCohortEdit}>
          <FormField id="edit-cohort-name" label="Cohort name">
            <input id="edit-cohort-name" name="name" required maxLength={120} defaultValue={editCohortTarget.name} />
          </FormField>
          <div className="form-row">
            <FormField id="edit-cohort-start" label="Starts on">
              <input id="edit-cohort-start" name="startsOn" type="date" required defaultValue={editCohortTarget.startsOn} />
            </FormField>
            <FormField id="edit-cohort-end" label="Ends on">
              <input id="edit-cohort-end" name="endsOn" type="date" required defaultValue={editCohortTarget.endsOn} />
            </FormField>
          </div>
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
        cohort={generationTarget}
        onClose={() => setGenerationTarget(null)}
        onSuccess={async () => {
          setCohorts(await getCohorts(selectedProgramId || undefined));
        }}
      />
    </div>
  );
}
