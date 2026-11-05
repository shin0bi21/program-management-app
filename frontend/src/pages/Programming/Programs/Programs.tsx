import { useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import PageContainer from '../../../common/components/PageContainer/PageContainer';
import Button from '../../../common/components/Button/Button';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { type PageMessageValue } from '../../../common/components/PageMessageOverlay/PageMessageOverlay';
import type { Program } from '../../../common/features/programs/types';
import type { ProgramFilters } from './api/programs.api';
import YouthReportModal from '../../../common/features/YouthReportModal/YouthReportModal';
import type { ProgramCycleAssignment } from './types';
import ManageRosterModal from './components/ManageRosterModal/ManageRosterModal';
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
import { useProgramCycleAssignments } from './hooks/data/useProgramCycleAssignments';
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
  const assignments = useProgramCycleAssignments();

  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const actions = useProgramsActions({
    programTableQueryKey: PROGRAM_TABLE_QUERY_KEY,
    onProgramSynced: saved => setSelectedProgram(current => current?.id === saved.id ? saved : current),
    onCycleDeleted: data.removeCycle,
  });

  const modals = useProgramsModals();
  const [cyclesOpen, setCyclesOpen] = useState(false);
  const [rosterTarget, setRosterTarget] = useState<ProgramCycleAssignment | null>(null);
  const [reportTarget, setReportTarget] = useState<ProgramCycleAssignment | null>(null);

  const { columns: programColumns } = useProgramTable(modals.program.open, modals.assignments.open, canWritePrograms, assignments);
  const { columns: cycleColumns } = useCycleTable({ onEdit: modals.cycle.open, onDelete: actions.requestCycleDeletion });

  return <>
    <PageContainer
      className="programs-page"
      title="Programs"
      ariaLabel="Programs and overview"
      actions={canWritePrograms ? <>
        <Button onClick={() => modals.program.open(null)}>+ Add Program</Button>
        <Button variant="secondary" onClick={() => setCyclesOpen(true)}>Manage Cycles</Button>
      </> : undefined}
      messages={[
        tableError,
        cycleTableError,
        data.programsError ? { message: data.programsError, action: { label: 'Retry', onClick: data.retryPrograms } } : null,
        data.cyclesError ? { message: data.cyclesError, action: { label: 'Retry', onClick: data.refreshCycles } } : null,
        assignments.error ? { message: assignments.error, action: { label: 'Retry', onClick: assignments.refresh } } : null,
      ]}
      dashboard={<ProgramOverviewDashboardCard
        program={selectedProgram}
        assignments={assignments.assignments.filter(assignment => assignment.programId === selectedProgram?.id)}
        loading={assignments.loading}
        error={assignments.error}
        onRetry={assignments.refresh}
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
    {canManageRoster && <ManageRosterModal assignment={rosterTarget} onClose={() => setRosterTarget(null)}
      onSuccess={saved => setRosterTarget(saved.programCycle)} />}
    {canViewYouthReport && reportTarget && <YouthReportModal programCycle={reportTarget} onClose={() => setReportTarget(null)} />}
  </>;
}
