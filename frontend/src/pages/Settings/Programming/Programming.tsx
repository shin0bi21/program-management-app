import { useCallback, useEffect, useMemo, useState } from 'react';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import { DashboardCard, DashboardCardGroup } from '../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import type { TableColumnDef } from '../../../common/components/Table/Table.types';
import useTableSelection from '../../../common/components/Table/hooks/useTableSelection';
import { deleteProgramCycle, getProgramCycles } from '../../../common/features/programming/api/cohorts.api';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import type { Program } from '../../../common/features/programs/types';
import type { ProgramCycle } from '../../../common/types/cohort';
import { formatShortDate } from '../../../common/utils/date';
import { getErrorMessage } from '../../../http/clientErrors';
import CycleModal from './components/CycleModal';
import CycleTable from './components/CycleTable/CycleTable';
import ProgramTable from './components/ProgramTable/ProgramTable';
import ProgramModal from './components/ProgramModal/ProgramModal';
import type { CycleModalTarget, ProgramModalTarget } from './types';
import './Programming.css';

export default function Programming() {
  // Remote program and cycle data.
  const { programs, upsertProgram, loading: programsLoading, error: programsError } = usePrograms();
  const [cycles, setCycles] = useState<ProgramCycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);
  const [cyclesError, setCyclesError] = useState<string | null>(null);

  // Selection and dialog state.
  const [programTarget, setProgramTarget] = useState<ProgramModalTarget>(undefined);
  const [cycleTarget, setCycleTarget] = useState<CycleModalTarget>(undefined);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const programSelection = useTableSelection(programs);
  const cycleSelection = useTableSelection(cycles);

  // Cycle loading and mutations.
  const refreshCycles = useCallback(async (signal?: AbortSignal) => {
    setCyclesLoading(true);
    try {
      setCycles(await getProgramCycles(signal ? { signal } : undefined));
      setCyclesError(null);
    } catch (cause) {
      if (!signal?.aborted) setCyclesError(getErrorMessage(cause, 'Could not load cycles'));
    } finally {
      if (!signal?.aborted) setCyclesLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshCycles(controller.signal);
    return () => controller.abort();
  }, [refreshCycles]);

  const requestCycleDeletion = useCallback((cycle: ProgramCycle) => {
    setConfirmAction({
      title: 'Delete Cycle',
      message: `Delete ${cycle.name}? Cycles assigned to cohorts or logged hours cannot be deleted.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      successMessage: 'Cycle deleted',
      onConfirm: async () => {
        await deleteProgramCycle(cycle.id);
        setCycles(current => current.filter(item => item.id !== cycle.id));
      },
    });
  }, []);

  // Table presentation and row actions.
  const programColumns = useMemo<TableColumnDef<Program>[]>(() => [
    { id: 'name', header: 'Program', accessorFn: program => program.name },
    { id: 'attendance', header: 'Attendance', accessorFn: program => program.rosterMode === 'open' ? 'Open attendance' : 'Enrollment required' },
    { id: 'ages', header: 'Ages', size: 120, accessorFn: program => program.minAge === null ? 'All ages' : `${program.minAge}–${program.maxAge}` },
    { id: 'actions', header: '', size: 40, enableResizing: false, enableHiding: false, cell: ({ row: { original: program } }) => (
      <ActionsMenu ariaLabel={`Actions for ${program.name}`} items={[{ id: 'edit', label: 'Edit Program', onClick: () => setProgramTarget(program) }]} />
    ) },
  ], []);

  const cycleColumns = useMemo<TableColumnDef<ProgramCycle>[]>(() => [
    { id: 'name', header: 'Cycle', accessorFn: cycle => cycle.name },
    { id: 'start', header: 'Start', size: 140, accessorFn: cycle => formatShortDate(cycle.startsOn) },
    { id: 'end', header: 'End', size: 140, accessorFn: cycle => formatShortDate(cycle.endsOn) },
    { id: 'actions', header: '', size: 40, enableResizing: false, enableHiding: false, cell: ({ row: { original: cycle } }) => (
      <ActionsMenu ariaLabel={`Actions for ${cycle.name}`} items={[
        { id: 'edit', label: 'Edit Cycle', onClick: () => setCycleTarget(cycle) },
        { id: 'delete', label: 'Delete Cycle', variant: 'danger', onClick: () => requestCycleDeletion(cycle) },
      ]} />
    ) },
  ], [requestCycleDeletion]);

  return (
    <main className="page-container page-container--data programming-settings-page">
      <PageHeader title="Programming Settings" />
      <DashboardCardGroup ariaLabel="Program and cycle management">
        <DashboardCard title="Programs" action={<Button size="sm" onClick={() => setProgramTarget(null)}>+ Add Program</Button>}>
          <ProgramTable
            columns={programColumns}
            programs={programs}
            loading={programsLoading}
            error={programsError ?? undefined}
            selectedKey={programSelection.selectedKey}
            onRowSelect={programSelection.selectItem}
          />
        </DashboardCard>
        <DashboardCard title="Cycles" action={<Button size="sm" onClick={() => setCycleTarget(null)}>+ Add Cycle</Button>}>
          <CycleTable
            columns={cycleColumns}
            cycles={cycles}
            loading={cyclesLoading}
            error={cyclesError ?? undefined}
            selectedKey={cycleSelection.selectedKey}
            onRowSelect={cycleSelection.selectItem}
          />
        </DashboardCard>
      </DashboardCardGroup>
      <ProgramModal
        isOpen={programTarget !== undefined}
        program={programTarget ?? null}
        onClose={() => setProgramTarget(undefined)}
        onSaved={upsertProgram}
      />
      <CycleModal
        isOpen={cycleTarget !== undefined}
        cycle={cycleTarget ?? null}
        onClose={() => setCycleTarget(undefined)}
        onSaved={refreshCycles}
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
    </main>
  );
}
