import { useMemo, useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { DashboardCard } from '../../../common/components/DashboardCard/DashboardCard';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageErrorOverlay, { type PageErrorItem } from '../../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import YouthReportModal from '../../../common/features/programming/components/YouthReportModal/YouthReportModal';
import { COHORT_TABLE_KEYS, type CohortListFilters, type ProgramCohort } from '../../../common/types/cohort';
import GenerateSessionsModal from '../common/components/GenerateSessionsModal/GenerateSessionsModal';
import AddCohortModal from './components/CohortModal/AddCohortModal';
import CohortTable from './components/CohortTable/CohortTable';
import useCohortTable from './components/CohortTable/hooks/useCohortTable';
import EditCohortModal from './components/CohortModal/EditCohortModal';
import ManageRosterModal from './components/ManageRosterModal/ManageRosterModal';
import useCohortActions from './hooks/actions/useCohortActions';
import useCohortData from './hooks/data/useCohortData';
import useCohortSelection from './hooks/selection/useCohortSelection';
import { useCohortControls } from './hooks/useCohortControls';
import './Cohorts.css';

const COHORT_TABLE_QUERY_KEY = ['cohorts', 'table'] as const;

export default function Cohorts() {
  const [viewError, setViewError] = useState<PageErrorItem | null>(null);

  // Permissions and application services.
  const { permissions, role } = useAuth();
  const canWriteCohorts = permissions.includes('write:cohorts');
  const canViewYouthReport = permissions.includes('read:attendance') && permissions.includes('read:sessions');

  // Page data and preferences.
  const { programs, programsLoading, programsError, cycles, cyclesError } = useCohortData();
  const controls = useCohortControls(
    role,
    programs,
    programsLoading,
    COHORT_TABLE_KEYS,
    programsError,
  );
  const {
    search, setSearch, appliedSearch, applySearch, clearSearch, programId: selectedProgramId, status: selectedStatus,
    sorting, columnWidths, hiddenColumns, error: preferenceError, filterCategories,
    ready: controlsReady,
  } = controls;

  // Filter configuration.
  const cohortFilters = useMemo<CohortListFilters | null>(() => controlsReady ? {
    programId: selectedProgramId || undefined,
    search: appliedSearch,
    status: selectedStatus || undefined,
  } : null, [appliedSearch, controlsReady, selectedProgramId, selectedStatus]);

  // Selection and actions.
  const selection = useCohortSelection();
  const actions = useCohortActions({
    tableQueryKey: COHORT_TABLE_QUERY_KEY,
    onCohortRemoved: selection.removeSelectedCohort,
  });

  // Add cohort modal.
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const openCohortModal = () => setCohortModalOpen(true);
  const closeCohortModal = () => setCohortModalOpen(false);

  // Roster modal.
  const [rosterTarget, setRosterTarget] = useState<ProgramCohort | null>(null);
  const closeRosterModal = () => setRosterTarget(null);

  // Youth report modal.
  const [reportTarget, setReportTarget] = useState<ProgramCohort | null>(null);
  const closeReportModal = () => setReportTarget(null);

  // Generate sessions modal.
  const [generationTarget, setGenerationTarget] = useState<ProgramCohort | null>(null);
  const closeGenerationModal = () => setGenerationTarget(null);

  // Edit cohort modal.
  const [editCohortTarget, setEditCohortTarget] = useState<ProgramCohort | null>(null);
  const closeEditCohortModal = () => setEditCohortTarget(null);

  // Table configuration.
  const columns = useCohortTable({
    canWrite: canWriteCohorts,
    onManageRoster: setRosterTarget,
    onGenerateSessions: setGenerationTarget,
    onEdit: setEditCohortTarget,
    onDelete: actions.requestDelete,
  });

  return (
    <>
      <main className="page-container">
        <PageHeader
          title="Cohorts"
          actions={
            canWriteCohorts
              ? <Button disabled={!programs.length || !cycles.length} onClick={openCohortModal}>+ Add Cohort</Button>
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

        <PageErrorOverlay errors={[programsError, cyclesError, preferenceError, viewError]} />
        {!controlsReady ? <p role="status">Loading saved cohort preferences…</p> : <PageBody
          ariaLabel="Programming cohorts and overview"
          table={
            <CohortTable
              queryKey={COHORT_TABLE_QUERY_KEY}
              filters={cohortFilters}
              columns={columns}
              hiddenColumnKeys={hiddenColumns}
              selectedKey={selection.selectedCohort?.id ?? null}
              onRowSelect={selection.setSelectedCohort}
              sorting={sorting}
              onSortingChange={controls.setSorting}
              columnWidths={columnWidths}
              onColumnWidthsChange={controls.setColumnWidths}
              onErrorChange={setViewError}
            />
          }
          dashboard={
            <DashboardCard
              title="Youth Overview"
              className="cohort-overview-card"
              emptyMessage="No cohort selected."
              action={selection.selectedCohort ? <Button
                size="sm"
                variant="secondary"
                disabled={!canViewYouthReport || selection.selectedCohort.rosterMode === 'open'}
                title={selection.selectedCohort.rosterMode === 'open' ? 'Drop In reporting is coming soon.' : undefined}
                onClick={() => setReportTarget(selection.selectedCohort)}
              >View Report</Button> : undefined}
            >
              {selection.selectedCohort ? (
                <dl className="cohort-overview">
                  <div><dt>{selection.selectedCohort.rosterMode === 'enrolled' ? 'Enrollment:' : 'Youth attended:'}</dt><dd>{selection.selectedCohort.rosterMode === 'enrolled' ? selection.selectedCohort.enrolledCount : selection.selectedCohort.uniqueAttendeeCount}</dd></div>
                  <div><dt>Average attendance:</dt><dd>{selection.selectedCohort.averageAttendance === null ? '—' : `${selection.selectedCohort.averageAttendance}%`}</dd></div>
                </dl>
              ) : undefined}
            </DashboardCard>
          }
        />}
      </main>

      <AddCohortModal
        isOpen={cohortModalOpen}
        programs={programs}
        cycles={cycles}
        initialProgramId={selectedProgramId}
        onClose={closeCohortModal}
        onCreated={actions.refreshCohorts}
      />

      <ManageRosterModal
        cohort={rosterTarget}
        onClose={closeRosterModal}
        onSuccess={actions.refreshRoster}
      />

      {reportTarget && <YouthReportModal cohort={reportTarget} onClose={closeReportModal} />}

      <EditCohortModal
        cohort={editCohortTarget}
        cycles={cycles}
        onClose={closeEditCohortModal}
        onUpdated={actions.refreshCohorts}
      />

      <GenerateSessionsModal
        cohort={generationTarget}
        onClose={closeGenerationModal}
        onSuccess={actions.refreshGeneratedSessions}
      />

      <ConfirmModal
        action={actions.confirmAction}
        onClose={actions.closeConfirmation}
      />
    </>
  );
}
