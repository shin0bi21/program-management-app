import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../common/components/Button/Button';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import FilterCard, { type FilterCardCategory } from '../../common/components/FilterCard/FilterCard';
import FloatingMenuPanel from '../../common/components/FloatingMenuPanel/FloatingMenuPanel';
import Modal from '../../common/components/Modal/Modal';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../common/components/Table/Table';
import TableDetailLayout from '../../common/components/TableDetailLayout/TableDetailLayout';
import { DashboardCard } from '../../common/components/DashboardCard/DashboardCard';
import { deleteCohort } from '../../common/api/cohorts.api';
import { useAuth } from '../../common/context/AuthContext';
import { useFloatingMenu } from '../../common/hooks/useFloatingMenu';
import { usePrograms } from '../../common/hooks/usePrograms';
import useTableSelection from '../../common/hooks/useTableSelection';
import { useConfirmModal, type ConfirmAction } from '../../common/hooks/useConfirmModal';
import type { ProgramCohort } from '../../common/types/cohort';
import { formatShortDate } from '../../common/utils/date';
import EnrollYouthModal from './components/EnrollYouthModal';
import GenerateSessionsModal from './components/GenerateSessionsModal';
import WithdrawYouthModal from './components/WithdrawYouthModal';
import AddProgramModal from './components/ProgramModal/AddProgramModal';
import AddCohortModal from './components/CohortModal/AddCohortModal';
import EditCohortModal from './components/CohortModal/EditCohortModal';
import { useCohorts } from './hooks/useCohorts';
import { getSingleAssignedProgram } from './utils/staffProgrammingDefaults';

export default function Programming() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions, role } = useAuth();
  const canWritePrograms = permissions.includes('write:programs');
  const canWriteCohorts = permissions.includes('write:cohorts');
  const {
    programs,
    setPrograms,
    loading: programsLoading,
    error: programsError,
  } = usePrograms({ assignedOnly: true });
  const staffDefaultsApplied = useRef(false);
  const selectedProgramId = searchParams.get('program') ?? '';
  const selectedStatus = searchParams.get('status') ?? '';
  const {
    cohorts,
    loading: cohortsLoading,
    error,
    refresh: refreshCohorts,
  } = useCohorts(selectedProgramId || undefined);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [enrollTarget, setEnrollTarget] = useState<ProgramCohort | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<ProgramCohort | null>(null);
  const [generationTarget, setGenerationTarget] = useState<ProgramCohort | null>(null);
  const [editCohortTarget, setEditCohortTarget] = useState<ProgramCohort | null>(null);
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
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (staffDefaultsApplied.current || programsLoading || role === null) return;
    staffDefaultsApplied.current = true;
    const assignedProgram = getSingleAssignedProgram(role, programs);
    if (!assignedProgram) return;

    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (!next.has('program')) {
      next.set('program', assignedProgram.id);
      changed = true;
    }
    if (!next.has('status')) {
      next.set('status', 'active');
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [programs, programsLoading, role, searchParams, setSearchParams]);

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
    { key: 'start', header: 'Start', width: '140px', render: cohort => formatShortDate(cohort.startsOn) },
    { key: 'end', header: 'End', width: '140px', render: cohort => formatShortDate(cohort.endsOn) },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: cohort => (
        <span className={`cohort-state cohort-state--${cohort.state}`}>{cohort.state}</span>
      ),
    },
    ...(canWriteCohorts ? [{
      key: 'actions',
      header: '',
      className: 'col-actions',
      render: (cohort: ProgramCohort) => <ActionsMenu
        ariaLabel={`More actions for ${cohort.name}`}
        items={[
          { id: 'add-sessions', label: 'Add Sessions', onClick: () => setGenerationTarget(cohort) },
          { id: 'edit', label: 'Edit Cohort', onClick: () => setEditCohortTarget(cohort) },
          {
            id: 'delete', label: 'Delete Cohort', variant: 'danger' as const, onClick: () => setConfirmAction({
              title: 'Delete Cohort',
              message: `Delete ${cohort.programName} · ${cohort.name}? Its sessions and enrollments will also be deleted. Cohorts with attendance cannot be deleted.`,
              confirmLabel: 'Delete',
              confirmVariant: 'danger',
              successMessage: 'Cohort deleted',
              onConfirm: async () => {
                await deleteCohort(cohort.id);
                await refreshCohorts();
              },
            }),
          },
        ]}
      />,
    }] : []),
  ], [canWriteCohorts, refreshCohorts]);

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

  const openProgramModal = () => {
    closeAddMenu();
    setProgramModalOpen(true);
  };
  const openCohortModal = () => {
    closeAddMenu();
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
              <div className="programming-card-actions">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!selectedCohort}
                  aria-label="Enroll youth"
                  onClick={() => {
                    if (selectedCohort) setEnrollTarget(selectedCohort);
                  }}
                >
                  Enroll
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!selectedCohort}
                  aria-label="Withdraw youth"
                  onClick={() => {
                    if (selectedCohort) setWithdrawTarget(selectedCohort);
                  }}
                >
                  Withdraw
                </Button>
              </div>
            ) : undefined}
          >
            {selectedCohort
              ? <strong className="dashboard-card__metric">
                  {selectedCohort.enrolledCount}
                </strong>
              : undefined}
          </DashboardCard>
          <DashboardCard
            title="Next session"
            emptyMessage="No cohort selected."
            action={selectedCohort?.nextSessionId ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/programming/sessions?session=${selectedCohort.nextSessionId}`)}
              >
                Go to
              </Button>
            ) : undefined}
          >
            {selectedCohort ? (
              <strong className="dashboard-card__metric">{selectedCohort.nextSessionAt
                ? formatShortDate(selectedCohort.nextSessionAt)
                : 'None'}</strong>
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

      <AddProgramModal
        isOpen={programModalOpen}
        onClose={() => setProgramModalOpen(false)}
        onCreated={program => {
          setPrograms(current => [...current, program].sort((a, b) => a.name.localeCompare(b.name)));
          selectProgram(program.id);
        }}
      />
      <AddCohortModal
        isOpen={cohortModalOpen}
        programs={programs}
        initialProgramId={selectedProgramId}
        onClose={() => setCohortModalOpen(false)}
        onCreated={refreshCohorts}
      />

      <EnrollYouthModal
        cohort={enrollTarget}
        onClose={() => setEnrollTarget(null)}
        onSuccess={refreshCohorts}
      />
      <WithdrawYouthModal
        cohort={withdrawTarget}
        onClose={() => setWithdrawTarget(null)}
        onSuccess={refreshCohorts}
      />
      <EditCohortModal
        cohort={editCohortTarget}
        onClose={() => setEditCohortTarget(null)}
        onUpdated={refreshCohorts}
      />

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
        onSuccess={refreshCohorts}
      />
    </div>
  );
}
