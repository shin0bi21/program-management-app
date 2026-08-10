import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../../../common/components/Button/Button';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import FilterCard, { type FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import Modal from '../../../common/components/Modal/Modal';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../../common/components/Table/Table';
import TableDetailLayout from '../../../common/components/TableDetailLayout/TableDetailLayout';
import { DashboardCard } from '../../../common/components/DashboardCard/DashboardCard';
import { deleteCohort, getProgramCycles } from '../../../common/features/programming/api/programming.api';
import { useAuth } from '../../../auth/authContext';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import useTableSelection from '../../../common/components/Table/hooks/useTableSelection';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
import useUserPreference from '../../../common/features/preferences/hooks/useUserPreference';
import type { CohortSortKey, ProgramCohort, ProgramCycle } from '../../../common/types/cohort';
import type { ListSort } from '../../../common/types/pagination';
import { formatShortDate } from '../../../common/utils/date';
import GenerateSessionsModal from '../common/components/GenerateSessionsModal/GenerateSessionsModal';
import { getSingleAssignedProgram } from '../common/utils/staffProgrammingDefaults';
import AddCohortModal from './components/CohortModal/AddCohortModal';
import EditCohortModal from './components/CohortModal/EditCohortModal';
import ManageRosterModal from './components/ManageRosterModal/ManageRosterModal';
import YouthReportModal from '../../../common/features/programming/components/YouthReportModal/YouthReportModal';
import './Cohorts.css';
import useCohortTable from './hooks/useCohortTable';

export default function Cohorts() {
  const { permissions, role } = useAuth();
  const canWriteCohorts = permissions.includes('write:cohorts');
  const canViewYouthReport = permissions.includes('read:attendance') && permissions.includes('read:sessions');
  const { programs, loading: programsLoading, error: programsError } = usePrograms({ assignedOnly: true });
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
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [cycles, setCycles] = useState<ProgramCycle[]>([]);
  const [cyclesError, setCyclesError] = useState<string | null>(null);
  const [rosterTarget, setRosterTarget] = useState<ProgramCohort | null>(null);
  const [reportTarget, setReportTarget] = useState<ProgramCohort | null>(null);
  const [generationTarget, setGenerationTarget] = useState<ProgramCohort | null>(null);
  const [editCohortTarget, setEditCohortTarget] = useState<ProgramCohort | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });

  const refreshCycles = useCallback(async (signal?: AbortSignal) => {
    try {
      setCycles(await getProgramCycles(signal ? { signal } : undefined));
      setCyclesError(null);
    } catch (cause) {
      if (signal?.aborted) return;
      setCyclesError(cause instanceof Error ? cause.message : 'Could not load cycles');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshCycles(controller.signal);
    return () => controller.abort();
  }, [refreshCycles]);

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
      { key: 'cohort', sortKey: 'cohort', header: 'Cycle', render: (cohort) => cohort.cycleName },
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
                    ...(cohort.rosterMode === 'enrolled'
                      ? [{ id: 'manage-roster', label: 'Manage Roster', onClick: () => setRosterTarget(cohort) }]
                      : []),
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

  return (
    <>
      <main className="page-container page-container--data">
        <div className="data-detail-page-content">
          <PageHeader
            title="Cohorts"
            actions={
              canWriteCohorts
                ? <Button disabled={!programs.length || !cycles.length} onClick={() => setCohortModalOpen(true)}>+ Add Cohort</Button>
                : undefined
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
          {cyclesError && <p className="form-error">{cyclesError}</p>}
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
              <DashboardCard
                title="Youth Overview"
                className="cohort-overview-card"
                emptyMessage="No cohort selected."
                action={selectedCohort ? <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canViewYouthReport || selectedCohort.rosterMode === 'open'}
                  title={selectedCohort.rosterMode === 'open' ? 'Drop In reporting is coming soon.' : undefined}
                  onClick={() => setReportTarget(selectedCohort)}
                >View Report</Button> : undefined}
              >
                {selectedCohort ? (
                  <dl className="cohort-overview">
                    <div><dt>{selectedCohort.rosterMode === 'enrolled' ? 'Enrollment:' : 'Youth attended:'}</dt><dd>{selectedCohort.rosterMode === 'enrolled' ? selectedCohort.enrolledCount : selectedCohort.uniqueAttendeeCount}</dd></div>
                    <div><dt>Average attendance:</dt><dd>{selectedCohort.averageAttendance === null ? '—' : `${selectedCohort.averageAttendance}%`}</dd></div>
                  </dl>
                ) : undefined}
              </DashboardCard>
            }
          />

          <AddCohortModal
            isOpen={cohortModalOpen}
            programs={programs}
            cycles={cycles}
            initialProgramId={selectedProgramId}
            onClose={() => setCohortModalOpen(false)}
            onCreated={refreshCohorts}
          />

          <ManageRosterModal cohort={rosterTarget} onClose={() => setRosterTarget(null)} onSuccess={refreshCohorts} />
          {reportTarget && <YouthReportModal cohort={reportTarget} onClose={() => setReportTarget(null)} />}
          <EditCohortModal
            cohort={editCohortTarget}
            cycles={cycles}
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
