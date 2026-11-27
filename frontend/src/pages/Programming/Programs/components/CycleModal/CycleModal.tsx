import type { ProgramCycleAssignment } from '../../types';
import Checklist from '../../../../../common/components/Checklist/Checklist';
import Button from '../../../../../common/components/Button/Button';
import type { ProgramReference } from '../../../../../common/features/referenceData/referenceData.api';
import FormField from '../../../../../common/components/FormField/FormField';
import FormFieldGroup from '../../../../../common/components/FormField/FormFieldGroup';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
import useCycleModal from './hooks/useCycleModal';
import type { SetCycleResult } from '../../api/cycles.api';

interface CycleModalProps {
  isOpen: boolean;
  cycle: ProgramCycle | null;
  programs: ProgramReference[];
  assignments: ProgramCycleAssignment[];
  assignmentsReady: boolean;
  assignmentsError: string;
  onRetryAssignments: () => void;
  programsReady?: boolean;
  programsError?: string | null;
  onRetryPrograms?: () => void;
  onClose: () => void;
  onSaved: (result: SetCycleResult, operation: 'create' | 'update') => void | Promise<void>;
}

/**
 * Displays a cycle editor with page-supplied program labels and its independent assignment draft.
 * @param props - Open/edit target, program choices and readiness, close action, and saved-result callback.
 * @example <CycleModal isOpen cycle={cycle} programs={programs} {...actions} />
 */
export default function CycleModal({ isOpen, ...props }: CycleModalProps) {
  if (!isOpen) return null;

  if (!props.assignmentsReady) {
    return <Modal isOpen title={props.cycle ? 'Edit Cycle' : 'Add Cycle'} onClose={props.onClose}>
      {props.assignmentsError
        ? <div role="alert">{props.assignmentsError} <Button onClick={props.onRetryAssignments}>Retry assignments</Button></div>
        : <p role="status">Loading assigned programs...</p>}
    </Modal>;
  }

  return <CycleForm key={props.cycle?.id ?? 'new'} {...props} />;
}

/**
 * Owns one cycle's fields and assignment choices until its editor closes.
 * @param props - Saved cycle and assignments, program choices, and save/close actions.
 * @example <CycleForm {...loadedCycleProps} />
 */
function CycleForm({ cycle, programs, assignments, programsReady = true, programsError, onRetryPrograms, onClose, onSaved }: Omit<CycleModalProps, 'isOpen'>) {
  const workflow = useCycleModal({ cycle, assignments, programsReady, onSaved });


  return (
    <Modal
      isOpen
      onClose={onClose}
      title={cycle ? 'Edit Cycle' : 'Add Cycle'}
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      footer={<ModalFormFooter formId="cycle-form" submitStatus={workflow.submitStatus} submitDisabled={!workflow.assignmentsReady} onClose={onClose} />}
    >
      <form
        id="cycle-form"
        aria-busy={workflow.submissionComplete}
        onSubmit={workflow.submit}
      >
        <FormField id="cycle-title" label="Cycle Title">
          <input id="cycle-title" {...workflow.register('title')} required maxLength={120} placeholder="Fall 2026" disabled={workflow.submissionComplete} />
        </FormField>
        <div className="form-row">
          <FormField id="cycle-start" label="Starts on">
            <input id="cycle-start" {...workflow.register('startsOn')} type="date" required disabled={workflow.submissionComplete} />
          </FormField>
          <FormField id="cycle-end" label="Ends on">
            <input id="cycle-end" {...workflow.register('endsOn')} type="date" required disabled={workflow.submissionComplete} />
          </FormField>
        </div>
        {programsError && <div role="alert">{programsError} <Button onClick={onRetryPrograms}>Retry programs</Button></div>}
        {!workflow.assignmentsReady && !programsError && <p role="status">Loading programs...</p>}
        <FormFieldGroup label="Assigned programs">
          <Checklist
            variant="form"
            ariaLabel="Assigned programs"
            options={programs.map(({ id, title }) => ({ id, label: title }))}
            value={workflow.selectedProgramIds}
            onToggle={workflow.toggleProgram}
            disabled={workflow.submissionComplete || !workflow.assignmentsReady}
          />
          {programs.length === 0 && <p>No programs yet.</p>}
        </FormFieldGroup>
      </form>
    </Modal>
  );
}
