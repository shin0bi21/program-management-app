import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../common/components/Button/Button';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import FilterCard, { type FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import FloatingMenuPanel from '../../../common/components/FloatingMenuPanel/FloatingMenuPanel';
import Header from '../../../common/components/Header/Header';
import Modal from '../../../common/components/Modal/Modal';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../../common/components/Table/Table';
import TableDetailLayout from '../../../common/components/TableDetailLayout/TableDetailLayout';
import { DashboardCard } from '../../../common/components/DashboardCard/DashboardCard';
import { deleteCohort } from '../../../common/api/cohorts.api';
import { useAuth } from '../../../common/context/AuthContext';
import { useFloatingMenu } from '../../../common/hooks/useFloatingMenu';
import { usePrograms } from '../../../common/hooks/usePrograms';
import useTableSelection from '../../../common/hooks/useTableSelection';
import { useConfirmModal, type ConfirmAction } from '../../../common/hooks/useConfirmModal';
import useUserPreference from '../../../common/hooks/useUserPreference';
import type { CohortSortKey, ProgramCohort } from '../../../common/types/cohort';
import type { ListSort } from '../../../common/types/pagination';
import { formatShortDate } from '../../../common/utils/date';
import GenerateSessionsModal from '../common/components/GenerateSessionsModal/GenerateSessionsModal';
import { getSingleAssignedProgram } from '../common/utils/staffProgrammingDefaults';
import AddCohortModal from './components/CohortModal/AddCohortModal';
import EditCohortModal from './components/CohortModal/EditCohortModal';
import EnrollYouthModal from './components/EnrollYouthModal/EnrollYouthModal';
import AddProgramModal from './components/ProgramModal/AddProgramModal';
import WithdrawYouthModal from './components/WithdrawYouthModal/WithdrawYouthModal';
import './Cohorts.css';
import useCohortTable from './hooks/useCohortTable';

export default function Cohorts() {
  const navigate = useNavigate();
  const { permissions, role } = useAuth();
  const canWritePrograms = permissions.includes('write:programs');
  const canWriteCohorts = permissions.includes('write:cohorts');
  const { programs, upsertProgram, loading: programsLoading, error: programsError } = usePrograms({ assignedOnly: true });
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [filtersReady, setFiltersReady] = useState(false);
  const [sorting, setSorting] = useState<ListSort<CohortSortKey>>({ key: 'start', direction: 'desc' });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const { preference, loading: preferenceLoading, error: preferenceError, save } = useUserPreference('cohort-filters');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const tableFilters = filtersReady ? { programId: selectedProgramId || undefined, search: debouncedSearch, status: selectedStatus || undefined } : null;
  const cohortTable = useCohortTable(tableFilters, sorting);
  const cohorts = cohortTable.rows;
  const cohortsLoading = cohortTable.loading;
  const error = cohortTable.error;
  const refreshCohorts = cohortTable.refetch;
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
  } = useFloatingMenu(addButtonRef, { side: 'right', align: 'start' }, { widthEstimate: 180, heightEstimate: 100 });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (filtersReady || preferenceLoading || programsLoading || role === null) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    const defaultProgram = getSingleAssignedProgram(role, programs)?.id ?? '';
    setSelectedProgramId(
      preference?.programId && availableProgramIds.has(preference.programId)
        ? preference.programId
        : preference ? '' : defaultProgram,
    );
    setSelectedStatus(preference?.status ?? (role === 'staff' ? 'active' : ''));
    setSorting(preference?.sorting ?? { key: 'start', direction: 'desc' });
    setColumnWidths(preference?.columnWidths ?? {});
    setFiltersReady(true);
  }, [filtersReady, preference, preferenceLoading, programs, programsLoading, role]);

  const {
    selectedItem: selectedCohort,
    selectedKey: selectedCohortId,
    selectItem: selectCohort,
  } = useTableSelection(cohorts);

  const filterCategories = useMemo<FilterCardCategory[]>(
    () => [
      {
        id: 'program',
        label: 'Program',
        selectionMode: 'single',
        options: programs.map((program) => ({ value: program.id, label: program.name })),
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
    ],
    [programs],
  );

  const columns = useMemo<TableColumn<ProgramCohort>[]>(
    () => [
      { key: 'program', sortKey: 'program', header: 'Program', render: (cohort) => cohort.programName },
      { key: 'cohort', sortKey: 'cohort', header: 'Cohort', render: (cohort) => cohort.name },
      { key: 'start', sortKey: 'start', header: 'Start', width: 140, render: (cohort) => formatShortDate(cohort.startsOn) },
      { key: 'end', sortKey: 'end', header: 'End', width: 140, render: (cohort) => formatShortDate(cohort.endsOn) },
      {
        key: 'status',
        sortKey: 'status',
        header: 'Status',
        width: 120,
        render: (cohort) => <span className={`cohort-state cohort-state--${cohort.state}`}>{cohort.state}</span>,
      },
      ...(canWriteCohorts
        ? [
            {
              key: 'actions',
              width: 40,
              resizable: false,
              header: '',
              className: 'col-actions',
              render: (cohort: ProgramCohort) => (
                <ActionsMenu
                  ariaLabel={`More actions for ${cohort.name}`}
                  items={[
                    { id: 'add-sessions', label: 'Add Sessions', onClick: () => setGenerationTarget(cohort) },
                    { id: 'edit', label: 'Edit Cohort', onClick: () => setEditCohortTarget(cohort) },
                    {
                      id: 'delete',
                      label: 'Delete Cohort',
                      variant: 'danger' as const,
                      onClick: () =>
                        setConfirmAction({
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
                />
              ),
            },
          ]
        : []),
    ],
    [canWriteCohorts, refreshCohorts],
  );

  const selectProgram = (programId: string) => {
    setSelectedProgramId(programId);
    void save({
      programId: programId || null,
      status: (selectedStatus || null) as 'active' | 'upcoming' | 'completed' | null, sorting, columnWidths,
    });
  };

  const selectStatus = (status: string) => {
    setSelectedStatus(status);
    void save({
      programId: selectedProgramId || null,
      status: (status || null) as 'active' | 'upcoming' | 'completed' | null, sorting, columnWidths,
    });
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
    <>
      <Header />
      <main className="page-container page-container--data">
        <div className="data-detail-page-content">
          <PageHeader
            title="Cohorts"
            actions={
              canWritePrograms ? (
                <>
                  <Button ref={addButtonRef} aria-haspopup="menu" aria-expanded={addMenuOpen} onClick={toggleAddMenu}>
                    + Add
                  </Button>
                  {addMenuPosition && (
                    <FloatingMenuPanel
                      menuRef={addMenuRef}
                      position={addMenuPosition}
                      onClose={closeAddMenu}
                      width={180}
                    >
                      <button type="button" role="menuitem" onClick={openProgramModal}>
                        Add Program
                      </button>
                      {canWriteCohorts && (
                        <button type="button" role="menuitem" disabled={!programs.length} onClick={openCohortModal}>
                          Add Cohort
                        </button>
                      )}
                    </FloatingMenuPanel>
                  )}
                </>
              ) : canWriteCohorts ? (
                <Button onClick={openCohortModal} disabled={!programs.length}>
                  + Add
                </Button>
              ) : undefined
            }
            search={
              <SearchInput
                label="Search cohorts"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search cohorts or programs"
              />
            }
            filters={
              <FilterCard
                categories={filterCategories}
                values={{
                  program: selectedProgramId ? [selectedProgramId] : [],
                  status: selectedStatus ? [selectedStatus] : [],
                }}
                onApply={(category, selected) => {
                  if (category === 'program') selectProgram(selected[0] ?? '');
                  if (category === 'status') selectStatus(selected[0] ?? '');
                }}
                onClearAll={() => {
                  setSelectedProgramId('');
                  setSelectedStatus('');
                  void save({ programId: null, status: null, sorting, columnWidths });
                }}
              />
            }
          />

          {programsError && <p className="form-error">{programsError}</p>}
          {preferenceError && <p className="form-error" role="alert">{preferenceError}</p>}
          <TableDetailLayout
            ariaLabel="Programming cohorts and overview"
            table={
              <Table
                ariaLabel="Cohorts"
                columns={columns}
                data={cohorts}
                loading={cohortsLoading}
                refreshing={cohortTable.refreshing}
                error={error ?? undefined}
                keyExtractor={(cohort) => cohort.id}
                selectedKey={selectedCohortId}
                onRowSelect={selectCohort}
                sorting={sorting}
                onSortingChange={next => { const value = next as ListSort<CohortSortKey>; setSorting(value); void save({ programId: selectedProgramId || null, status: (selectedStatus || null) as 'active' | 'upcoming' | 'completed' | null, sorting: value, columnWidths }); }}
                columnWidths={columnWidths}
                onColumnWidthsChange={next => { setColumnWidths(next); void save({ programId: selectedProgramId || null, status: (selectedStatus || null) as 'active' | 'upcoming' | 'completed' | null, sorting, columnWidths: next }); }}
                hasNextPage={cohortTable.hasNextPage}
                loadingNextPage={cohortTable.loadingNextPage}
                onLoadNextPage={cohortTable.loadNextPage}
                emptyMessage={
                  selectedProgramId || selectedStatus || debouncedSearch
                    ? 'No cohorts match your search and filters'
                    : 'No cohorts yet'
                }
              />
            }
            details={
              <>
                <DashboardCard
                  title={!selectedCohort || selectedCohort.rosterMode === 'enrolled' ? 'Youth enrolled' : 'Youth attended'}
                  emptyMessage="No cohort selected."
                  action={
                    !selectedCohort || selectedCohort.rosterMode === 'enrolled' ? (
                      <div className="cohort-card-actions">
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
                    ) : undefined
                  }
                >
                  {selectedCohort ? (
                    <strong className="dashboard-card__metric">
                      {selectedCohort.rosterMode === 'enrolled'
                        ? selectedCohort.enrolledCount
                        : selectedCohort.uniqueAttendeeCount}
                    </strong>
                  ) : undefined}
                </DashboardCard>
                <DashboardCard
                  title="Next session"
                  emptyMessage="No cohort selected."
                  action={
                    selectedCohort?.nextSessionId ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/programming/sessions?session=${selectedCohort.nextSessionId}`)}
                      >
                        Go to
                      </Button>
                    ) : undefined
                  }
                >
                  {selectedCohort ? (
                    <strong className="dashboard-card__metric">
                      {selectedCohort.nextSessionAt ? formatShortDate(selectedCohort.nextSessionAt) : 'None'}
                    </strong>
                  ) : undefined}
                </DashboardCard>
                <DashboardCard title="Average attendance" emptyMessage="No cohort selected.">
                  {selectedCohort ? (
                    <strong className="dashboard-card__metric">
                      {selectedCohort.averageAttendance === null ? '—' : `${selectedCohort.averageAttendance}%`}
                    </strong>
                  ) : undefined}
                </DashboardCard>
              </>
            }
          />

          <AddProgramModal
            isOpen={programModalOpen}
            onClose={() => setProgramModalOpen(false)}
            onCreated={(program) => {
              upsertProgram(program);
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

          <EnrollYouthModal cohort={enrollTarget} onClose={() => setEnrollTarget(null)} onSuccess={refreshCohorts} />
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
      </main>
    </>
  );
}
