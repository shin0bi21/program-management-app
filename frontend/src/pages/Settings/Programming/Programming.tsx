import { useMemo } from 'react';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { DashboardCard } from '../../../common/components/DashboardCard/DashboardCard';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import PageErrorOverlay from '../../../common/components/PageErrorOverlay/PageErrorOverlay';
import type { TableColumnDef } from '../../../common/components/Table/Table.types';
import useTableSelection from '../../../common/components/Table/hooks/useTableSelection';
import type { Program } from '../../../common/features/programs/types';
import type { ProgramCycle } from '../../../common/types/cohort';
import { formatShortDate } from '../../../common/utils/date';
import CycleModal from './components/CycleModal/CycleModal';
import CycleTable from './components/CycleTable/CycleTable';
import ProgramTable from './components/ProgramTable/ProgramTable';
import ProgramModal from './components/ProgramModal/ProgramModal';
import useProgrammingActions from './hooks/actions/useProgrammingActions';
import useProgrammingData from './hooks/data/useProgrammingData';
import useProgrammingModals from './hooks/useProgrammingModals';
import './Programming.css';

export default function Programming() {
  // Page data.
  const data = useProgrammingData();

  // Selection.
  const programSelection = useTableSelection(data.programs);
  const cycleSelection = useTableSelection(data.cycles);

  // Actions.
  const {
    closeConfirmation,
    confirmAction,
    requestCycleDeletion,
  } = useProgrammingActions({ onCycleDeleted: data.removeCycle });

  // Modal workflows.
  const modals = useProgrammingModals();

  // Table configuration.
  const programColumns = useMemo<TableColumnDef<Program>[]>(() => [
    { id: 'name', header: 'Program', accessorFn: program => program.name },
    { id: 'attendance', header: 'Attendance', accessorFn: program => program.rosterMode === 'open' ? 'Open attendance' : 'Enrollment required' },
    { id: 'ages', header: 'Ages', size: 120, accessorFn: program => program.minAge === null ? 'All ages' : `${program.minAge}–${program.maxAge}` },
    { id: 'actions', header: '', size: 40, enableResizing: false, enableHiding: false, cell: ({ row: { original: program } }) => (
      <ActionsMenu ariaLabel={`Actions for ${program.name}`} items={[{ id: 'edit', label: 'Edit Program', onClick: () => modals.program.open(program) }]} />
    ) },
  ], [modals.program]);

  const cycleColumns = useMemo<TableColumnDef<ProgramCycle>[]>(() => [
    { id: 'name', header: 'Cycle', accessorFn: cycle => cycle.name },
    { id: 'start', header: 'Start', size: 140, accessorFn: cycle => formatShortDate(cycle.startsOn) },
    { id: 'end', header: 'End', size: 140, accessorFn: cycle => formatShortDate(cycle.endsOn) },
    { id: 'actions', header: '', size: 40, enableResizing: false, enableHiding: false, cell: ({ row: { original: cycle } }) => (
      <ActionsMenu ariaLabel={`Actions for ${cycle.name}`} items={[
        { id: 'edit', label: 'Edit Cycle', onClick: () => modals.cycle.open(cycle) },
        { id: 'delete', label: 'Delete Cycle', variant: 'danger', onClick: () => requestCycleDeletion(cycle) },
      ]} />
    ) },
  ], [modals.cycle, requestCycleDeletion]);

  // View composition.
  const programsPanel = <DashboardCard
    title="Programs"
    action={<Button size="sm" onClick={() => modals.program.open(null)}>+ Add Program</Button>}
  >
    <ProgramTable
      columns={programColumns}
      programs={data.programs}
      loading={data.programsLoading}
      error={data.programsError ?? undefined}
      onRetry={data.retryPrograms}
      selectedKey={programSelection.selectedKey}
      onRowSelect={programSelection.selectItem}
    />
  </DashboardCard>;

  const cyclesPanel = <DashboardCard
    title="Cycles"
    action={<Button size="sm" onClick={() => modals.cycle.open(null)}>+ Add Cycle</Button>}
  >
    <CycleTable
      columns={cycleColumns}
      cycles={data.cycles}
      loading={data.cyclesLoading}
      error={data.cyclesError ?? undefined}
      onRetry={data.refreshCycles}
      selectedKey={cycleSelection.selectedKey}
      onRowSelect={cycleSelection.selectItem}
    />
  </DashboardCard>;

  // Render.
  return <>
    <main className="page-container page-container--data programming-settings-page">
      <PageHeader title="Programming Settings" />
      <PageErrorOverlay errors={[
        data.programsError ? {
          message: data.programsError,
          action: { label: 'Retry', onClick: data.retryPrograms },
        } : null,
        data.cyclesError ? {
          message: data.cyclesError,
          action: { label: 'Retry', onClick: data.refreshCycles },
        } : null,
      ]} />
      <PageBody
        ariaLabel="Program and cycle management"
        dashboard={programsPanel}
        table={cyclesPanel}
      />
    </main>

    <ProgramModal
      isOpen={modals.program.target !== undefined}
      program={modals.program.target ?? null}
      onClose={modals.program.close}
      onSaved={data.upsertProgram}
    />
    <CycleModal
      isOpen={modals.cycle.target !== undefined}
      cycle={modals.cycle.target ?? null}
      onClose={modals.cycle.close}
      onSaved={data.refreshCycles}
    />
    <ConfirmModal
      action={confirmAction}
      onClose={closeConfirmation}
    />
  </>;
}
