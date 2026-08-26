import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../auth/authContext';
import { removeInfiniteListRow } from '../../../query/infiniteListCache';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { type ConfirmAction } from '../../../common/components/ConfirmModal/types';
import { DashboardCard } from '../../../common/components/DashboardCard/DashboardCard';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import type { CellContext } from '@tanstack/react-table';
import type { TableColumnDef } from '../../../common/components/Table/Table.types';
import { deleteCohort, getProgramCycles } from '../../../common/features/programming/api/cohorts.api';
import YouthReportModal from '../../../common/features/programming/components/YouthReportModal/YouthReportModal';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import { YOUTH_QUERY_KEY } from '../../../common/features/youth/queryKeys';
import { COHORT_TABLE_KEYS, type ProgramCohort, type ProgramCycle } from '../../../common/types/cohort';
import { formatShortDate } from '../../../common/utils/date';
import GenerateSessionsModal from '../common/components/GenerateSessionsModal/GenerateSessionsModal';
import { COHORT_OPTIONS_QUERY_KEY, SESSION_QUERY_KEY } from '../common/queryKeys';
import AddCohortModal from './components/CohortModal/AddCohortModal';
import CohortTable from './components/CohortTable/CohortTable';
import EditCohortModal from './components/CohortModal/EditCohortModal';
import ManageRosterModal from './components/ManageRosterModal/ManageRosterModal';
import { useCohortControls } from './hooks/useCohortControls';
import './Cohorts.css';

const COHORT_TABLE_QUERY_KEY = ['cohorts', 'table'] as const;

export default function Cohorts() {
  // Application services and permission capabilities.
  const queryClient = useQueryClient();
  const { permissions, role } = useAuth();
  const canWriteCohorts = permissions.includes('write:cohorts');
  const canViewYouthReport = permissions.includes('read:attendance') && permissions.includes('read:sessions');

  // Shared options, persisted controls, and remote records.
  const { programs, loading: programsLoading, error: programsError } = usePrograms({ assignedOnly: true });
  const controls = useCohortControls(
    role,
    programs,
    programsLoading,
    COHORT_TABLE_KEYS,
    programsError,
  );
  const {
    search, setSearch, appliedSearch, applySearch, clearSearch, tableFilters, programId: selectedProgramId, status: selectedStatus,
    sorting, columnWidths, hiddenColumns, error: preferenceError, filterCategories,
    hasActiveQueryFilters, ready: controlsReady,
  } = controls;
  const refreshCohorts = useCallback(
    () => Promise.all([
      queryClient.invalidateQueries({ queryKey: COHORT_TABLE_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: COHORT_OPTIONS_QUERY_KEY }),
    ]).then(() => undefined),
    [queryClient],
  );

  // Page selection and dialog state.
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [cycles, setCycles] = useState<ProgramCycle[]>([]);
  const [cyclesError, setCyclesError] = useState<string | null>(null);
  const [rosterTarget, setRosterTarget] = useState<ProgramCohort | null>(null);
  const [reportTarget, setReportTarget] = useState<ProgramCohort | null>(null);
  const [generationTarget, setGenerationTarget] = useState<ProgramCohort | null>(null);
  const [editCohortTarget, setEditCohortTarget] = useState<ProgramCohort | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

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

  const [selectedCohort, setSelectedCohort] = useState<ProgramCohort | null>(null);

  // Table presentation and row actions.
  const columns = useMemo<TableColumnDef<ProgramCohort>[]>(
    () => [
      { id: 'program', header: 'Program', accessorFn: cohort => cohort.programName },
      { id: 'cohort', header: 'Cycle', accessorFn: cohort => cohort.cycleName },
      { id: 'start', header: 'Start', size: 140, accessorFn: cohort => formatShortDate(cohort.startsOn) },
      { id: 'end', header: 'End', size: 140, accessorFn: cohort => formatShortDate(cohort.endsOn) },
      {
        id: 'status',
        header: 'Status',
        size: 120,
        accessorFn: cohort => cohort.state,
        cell: ({ row: { original: cohort } }) => <span className={`cohort-state cohort-state--${cohort.state}`}>{cohort.state}</span>,
      },
      ...(canWriteCohorts
        ? [
            {
              id: 'actions',
              size: 40,
              enableResizing: false,
              enableHiding: false,
              header: '',

              cell: ({ row: { original: cohort } }: CellContext<ProgramCohort, unknown>) => (
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
                            removeInfiniteListRow(queryClient, COHORT_TABLE_QUERY_KEY, cohort.id);
                            await queryClient.invalidateQueries({ queryKey: COHORT_OPTIONS_QUERY_KEY });
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
    [canWriteCohorts, queryClient],
  );

  return (
    <>
      <main className="page-container page-container--data">
        <div className="data-page">
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
                appliedValue={appliedSearch}
                onChange={(event) => setSearch(event.target.value)}
                onApply={applySearch}
                onClear={clearSearch}
                placeholder="Search cohorts or programs"
              />
            }
            columns={controlsReady ? <ColumnVisibilityMenu columns={columns} hiddenColumnKeys={hiddenColumns} onHiddenColumnKeysChange={controls.setHiddenColumns} /> : undefined}
            filters={controlsReady ? (
              <FilterCard
                categories={filterCategories}
                values={{
                  program: selectedProgramId ? [selectedProgramId] : [],
                  status: selectedStatus ? [selectedStatus] : [],
                }}
                onApply={controls.applyFilter}
                onClearAll={controls.clearFilters}
              />
            ) : undefined}
          />

          {programsError && <p className="form-error">{programsError}</p>}
          {cyclesError && <p className="form-error">{cyclesError}</p>}
          {preferenceError && <p className="form-error" role="alert">{preferenceError}</p>}
          {!controlsReady ? <p role="status">Loading saved cohort preferences…</p> : <PageBody
            ariaLabel="Programming cohorts and overview"
            table={
              <CohortTable
                queryKey={COHORT_TABLE_QUERY_KEY}
                filters={tableFilters}
                columns={columns}
                hiddenColumnKeys={hiddenColumns}
                selectedKey={selectedCohort?.id ?? null}
                onRowSelect={setSelectedCohort}
                sorting={sorting}
                onSortingChange={controls.setSorting}
                columnWidths={columnWidths}
                onColumnWidthsChange={controls.setColumnWidths}
                hasActiveQueryFilters={hasActiveQueryFilters}
              />
            }
            dashboard={
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
          />}

          <AddCohortModal
            isOpen={cohortModalOpen}
            programs={programs}
            cycles={cycles}
            initialProgramId={selectedProgramId}
            onClose={() => setCohortModalOpen(false)}
            onCreated={refreshCohorts}
          />

          <ManageRosterModal
            cohort={rosterTarget}
            onClose={() => setRosterTarget(null)}
            onSuccess={() => Promise.all([
              refreshCohorts(),
              queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
            ]).then(() => undefined)}
          />
          {reportTarget && <YouthReportModal cohort={reportTarget} onClose={() => setReportTarget(null)} />}
          <EditCohortModal
            cohort={editCohortTarget}
            cycles={cycles}
            onClose={() => setEditCohortTarget(null)}
            onUpdated={refreshCohorts}
          />

          <ConfirmModal
            action={confirmAction}
            onClose={() => setConfirmAction(null)}
          />

          <GenerateSessionsModal
            cohort={generationTarget}
            onClose={() => setGenerationTarget(null)}
            onSuccess={async () => {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
                refreshCohorts(),
              ]);
            }}
          />
        </div>
      </main>
    </>
  );
}
