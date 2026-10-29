import { useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import Button from '../../../common/components/Button/Button';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import PageMessageOverlay, { type PageMessageValue } from '../../../common/components/PageMessageOverlay/PageMessageOverlay';
import type { Program } from '../../../common/features/programs/types';
import type { ProgramFilters } from './api/programs.api';
import YouthReportModal from '../../../common/features/YouthReportModal/YouthReportModal';
import type { ProgramCohort } from '../Cohorts/types';
import ManageRosterModal from '../Cohorts/components/ManageRosterModal/ManageRosterModal';
import CycleModal from './components/CycleModal/CycleModal';
import CycleTable from './components/CycleTable/CycleTable';
import useCycleTable from './components/CycleTable/hooks/useCycleTable';
import ProgramTable from './components/ProgramTable/ProgramTable';
import useProgramTable from './components/ProgramTable/hooks/useProgramTable';
import ProgramCyclesModal from './components/ProgramCyclesModal/ProgramCyclesModal';
import ProgramModal from './components/ProgramModal/ProgramModal';
import ProgramOverviewDashboardCard from './components/ProgramOverviewDashboardCard/ProgramOverviewDashboardCard';
import useProgramsActions from './hooks/actions/useProgramsActions';
import useProgramsData from './hooks/data/useProgramsData';
import { useCohorts } from './hooks/data/useCohorts';
import useProgramsModals from './hooks/useProgramsModals';

const PROGRAM_TABLE_QUERY_KEY = ['programs', 'table'] as const;
const PROGRAM_FILTERS: ProgramFilters = { assignedOnly: true };

export default function Programs() {
  const [cycleTableError, setCycleTableError] = useState<PageMessageValue>(null);
  const [tableError, setTableError] = useState<PageMessageValue>(null);
  const { permissions } = useAuth();
  const canWritePrograms = permissions.includes('write:programs');
  const canManageRoster = permissions.includes('write:enrollments') && permissions.includes('read:youth_profiles');
  const canViewYouthReport = permissions.includes('read:attendance') && permissions.includes('read:sessions');

  const data = useProgramsData();
  const cohorts = useCohorts();

  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const actions = useProgramsActions({
    programTableQueryKey: PROGRAM_TABLE_QUERY_KEY,
    onProgramSynced: saved => setSelectedProgram(current => current?.id === saved.id ? saved : current),
    onCycleDeleted: data.removeCycle,
  });

  const modals = useProgramsModals();
  const [cyclesOpen, setCyclesOpen] = useState(false);
  const [rosterTarget, setRosterTarget] = useState<ProgramCohort | null>(null);
  const [reportTarget, setReportTarget] = useState<ProgramCohort | null>(null);

  const { columns: programColumns } = useProgramTable(modals.program.open, modals.assignments.open, canWritePrograms, cohorts);
  const { columns: cycleColumns } = useCycleTable({ onEdit: modals.cycle.open, onDelete: actions.requestCycleDeletion });

  return <>
    <main className="page-container programs-page">
      <PageHeader title="Programs" actions={canWritePrograms ? <>
        <Button onClick={() => modals.program.open(null)}>+ Add Program</Button>
        <Button variant="secondary" onClick={() => setCyclesOpen(true)}>Manage Cycles</Button>
      </> : undefined} />
      <PageMessageOverlay messages={[
        tableError,
        cycleTableError,
        data.programsError ? { message: data.programsError, action: { label: 'Retry', onClick: data.retryPrograms } } : null,
        data.cyclesError ? { message: data.cyclesError, action: { label: 'Retry', onClick: data.refreshCycles } } : null,
        cohorts.error ? { message: cohorts.error, action: { label: 'Retry', onClick: cohorts.refresh } } : null,
      ]} />
      <PageBody
        ariaLabel="Programs and overview"
        dashboard={<ProgramOverviewDashboardCard
          program={selectedProgram}
          cohorts={cohorts.cohorts.filter(cohort => cohort.programId === selectedProgram?.id)}
          loading={cohorts.loading}
          error={cohorts.error}
          onRetry={cohorts.refresh}
          canManageRoster={canManageRoster}
          canViewYouthReport={canViewYouthReport}
          onManageRoster={setRosterTarget}
          onViewReport={setReportTarget}
        />}
        table={<ProgramTable
          columns={programColumns}
          queryKey={PROGRAM_TABLE_QUERY_KEY}
          filters={PROGRAM_FILTERS}
          onMessageChange={setTableError}
          selectedProgramId={selectedProgram?.id}
          onProgramSelect={setSelectedProgram}
        />}
      />
    </main>

    {canWritePrograms && <>
      <CycleTable columns={cycleColumns} onMessageChange={setCycleTableError}
        isOpen={cyclesOpen && modals.cycle.target === undefined && !actions.confirmAction}
        enabled={cyclesOpen} onClose={() => setCyclesOpen(false)} onAdd={() => modals.cycle.open(null)} />
      <ProgramModal isOpen={modals.program.target !== undefined} program={modals.program.target ?? null}
        onClose={modals.program.close} onSaved={actions.syncProgram} />
      {modals.assignments.target && <ProgramCyclesModal key={modals.assignments.target.id}
        program={modals.assignments.target} cycles={data.cycles} cyclesLoading={data.cyclesLoading}
        cyclesError={data.cyclesError} onRetryCycles={data.refreshCycles} onClose={modals.assignments.close} />}
      <CycleModal isOpen={modals.cycle.target !== undefined} cycle={modals.cycle.target ?? null}
        programs={data.programs} programsReady={!data.programsLoading && !data.programsError}
        programsError={data.programsError} onRetryPrograms={data.retryPrograms}
        onClose={modals.cycle.close} onSaved={actions.syncCycle} />
      <ConfirmModal action={actions.confirmAction} onClose={actions.closeConfirmation} />
    </>}
    {canManageRoster && <ManageRosterModal cohort={rosterTarget} onClose={() => setRosterTarget(null)}
      onSuccess={saved => setRosterTarget(saved.cohort)} />}
    {canViewYouthReport && reportTarget && <YouthReportModal cohort={reportTarget} onClose={() => setReportTarget(null)} />}
  </>;
}
