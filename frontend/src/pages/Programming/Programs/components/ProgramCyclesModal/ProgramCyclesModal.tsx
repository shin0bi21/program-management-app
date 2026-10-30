import Checklist from '../../../../../common/components/Checklist/Checklist';
import Button from '../../../../../common/components/Button/Button';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
import useProgramCyclesModal from './hooks/useProgramCyclesModal';

interface ProgramCyclesModalProps {
  program: Program;
  cycles: ProgramCycle[];
  cyclesLoading: boolean;
  cyclesError: string | null;
  onRetryCycles: () => void;
  onClose: () => void;
}

export default function ProgramCyclesModal({
  program, cycles, cyclesLoading, cyclesError, onRetryCycles, onClose,
}: ProgramCyclesModalProps) {
  const workflow = useProgramCyclesModal(program.id, !cyclesLoading && !cyclesError);

  return <Modal
    isOpen
    title={`Assigned Cycles — ${program.name}`}
    onClose={onClose}
    status={workflow.submitStatus}
    statusMessage={workflow.statusMessage}
    footer={<ModalFormFooter
      formId="program-cycles-form"
      submitLabel="Save Assigned Cycles"
      submitStatus={workflow.submitStatus}
      submitDisabled={!workflow.ready}
      onClose={onClose}
    />}
  >
    <form id="program-cycles-form" onSubmit={event => {
      event.preventDefault();
      void workflow.submit();
    }} aria-busy={workflow.loading || cyclesLoading || workflow.locked}>
      {cyclesError && <div role="alert">{cyclesError} <Button onClick={onRetryCycles}>Retry cycles</Button></div>}
      {workflow.error && <div role="alert">{workflow.error} <Button onClick={workflow.retry}>Retry assignments</Button></div>}
      {(workflow.loading || cyclesLoading) && <p role="status">Loading assigned cycles...</p>}
      {workflow.selectedCycleIds !== null && <Checklist
        variant="form"
        ariaLabel="Assigned cycles"
        options={cycles.map(cycle => ({ value: cycle.id, label: cycle.name }))}
        value={workflow.selectedCycleIds}
        onToggle={workflow.toggleCycle}
        disabled={!workflow.ready || workflow.locked}
      />}
      {!cyclesLoading && !cyclesError && cycles.length === 0 && <p>No cycles yet. Add a cycle from Manage Cycles first.</p>}
    </form>
  </Modal>;
}
