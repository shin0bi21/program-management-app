import type { ProgramCycleAssignment, Program } from '../../types';
import Checklist from '../../../../../common/components/Checklist/Checklist';
import FormFieldGroup from '../../../../../common/components/FormField/FormFieldGroup';
import Button from '../../../../../common/components/Button/Button';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
import useProgramCyclesModal from './hooks/useProgramCyclesModal';

interface ProgramCyclesModalProps {
  program: Program;
  assignments: ProgramCycleAssignment[];
  assignmentsReady: boolean;
  assignmentsError: string;
  onRetryAssignments: () => void;
  cycles: ProgramCycle[];
  cyclesLoading: boolean;
  cyclesError: string | null;
  onRetryCycles: () => void;
  onClose: () => void;
}

/**
 * Edits a program's assigned cycles from the collection already loaded by the page.
 * @param props - Saved program, assignment rows and choices, load recovery, and close action.
 * @example <ProgramCyclesModal {...loadedProgramProps} />
 */
export default function ProgramCyclesModal(props: ProgramCyclesModalProps) {
  if (!props.assignmentsReady) {
    return <Modal isOpen title={`Assigned Cycles — ${props.program.title}`} onClose={props.onClose}>
      {props.assignmentsError
        ? <div role="alert">{props.assignmentsError} <Button onClick={props.onRetryAssignments}>Retry assignments</Button></div>
        : <p role="status">Loading assigned cycles...</p>}
    </Modal>;
  }

  return <ProgramCyclesForm key={props.program.id} {...props} />;
}

/**
 * Owns one program's assigned-cycle draft while its editor is mounted.
 * @param props - Supplied assignments, current cycle choices, and close action.
 * @example <ProgramCyclesForm {...loadedProgramProps} />
 */
function ProgramCyclesForm({
  program, assignments, cycles, cyclesLoading, cyclesError, onRetryCycles, onClose,
}: ProgramCyclesModalProps) {
  const workflow = useProgramCyclesModal(program.id, assignments, !cyclesLoading && !cyclesError);

  return <Modal
    isOpen
    title={`Assigned Cycles — ${program.title}`}
    onClose={onClose}
    status={workflow.submitStatus}
    statusMessage={workflow.statusMessage}
    footer={<ModalFormFooter
      formId="program-cycles-form"
      submitStatus={workflow.submitStatus}
      submitDisabled={!workflow.ready}
      onClose={onClose}
    />}
  >
    <form id="program-cycles-form" onSubmit={workflow.submit} aria-busy={cyclesLoading || workflow.locked}>
      {cyclesError && <div role="alert">{cyclesError} <Button onClick={onRetryCycles}>Retry cycles</Button></div>}
      {cyclesLoading && <p role="status">Loading cycles...</p>}
      <FormFieldGroup label="Assigned cycles">
        <Checklist
          variant="form"
          ariaLabel="Assigned cycles"
          options={cycles.map(({ id, title }) => ({ id, label: title }))}
          value={workflow.selectedCycleIds}
          onToggle={workflow.toggleCycle}
          disabled={!workflow.ready || workflow.locked}
        />
      </FormFieldGroup>
      {!cyclesLoading && !cyclesError && cycles.length === 0 && <p>No cycles yet. Add a cycle from Manage Cycles first.</p>}
    </form>
  </Modal>;
}
