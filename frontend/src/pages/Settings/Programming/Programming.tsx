import Button from '../../../common/components/Button/Button';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { DashboardCard } from '../../../common/components/DashboardCard/DashboardCard';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import PageErrorOverlay from '../../../common/components/PageErrorOverlay/PageErrorOverlay';
import CycleModal from './components/CycleModal/CycleModal';
import CycleTable from './components/CycleTable/CycleTable';
import useCycleTable from './components/CycleTable/hooks/useCycleTable';
import ProgramTable from './components/ProgramTable/ProgramTable';
import useProgramTable from './components/ProgramTable/hooks/useProgramTable';
import ProgramModal from './components/ProgramModal/ProgramModal';
import useProgrammingActions from './hooks/actions/useProgrammingActions';
import useProgrammingData from './hooks/data/useProgrammingData';
import useProgrammingModals from './hooks/useProgrammingModals';
import './Programming.css';

export default function Programming() {
  // Page data.
  const data = useProgrammingData();

  // Actions.
  const {
    closeConfirmation,
    confirmAction,
    requestCycleDeletion,
  } = useProgrammingActions({ onCycleDeleted: data.removeCycle });

  // Modal workflows.
  const modals = useProgrammingModals();

  // Table configuration.
  const { columns: programColumns } = useProgramTable(modals.program.open);
  const { columns: cycleColumns } = useCycleTable({
    onEdit: modals.cycle.open,
    onDelete: requestCycleDeletion,
  });

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
    />
  </DashboardCard>;

  // Render.
  return <>
    <main className="page-container programming-settings-page">
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
