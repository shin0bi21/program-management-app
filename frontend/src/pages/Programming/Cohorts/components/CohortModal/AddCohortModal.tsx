import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCycle } from '../../../../../common/types/cohort';

import { useAddCohortModal } from './hooks/useAddCohortModal';

interface AddCohortModalProps {
  isOpen: boolean;
  programs: Program[];
  cycles: ProgramCycle[];
  initialProgramId: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

export default function AddCohortModal({
  isOpen,
  programs,
  cycles,
  initialProgramId,
  onClose,
  onCreated,
}: AddCohortModalProps) {
  const form = useAddCohortModal({ isOpen, programs, cycles, initialProgramId, onCreated });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Cohort"
      status={form.status}
      statusMessage={form.statusMessage}
      successDelay={1400}
      footer={(
        <ModalFormFooter
          formId="add-cohort-form"
          submitLabel="Add Cohort"
          submitStatus={form.status}
          onClose={onClose}
        />
      )}
    >
      <form id="add-cohort-form" onSubmit={(event) => void form.submit(event)}>
        <FormField id="cohort-program" label="Program">
          <FloatingSelect
            id="cohort-program"
            value={form.programId}
            options={programs.map((program) => ({ value: program.id, label: program.name }))}
            onChange={form.setProgramId}
            placeholder="Choose a program"
            disabled={form.submissionComplete}
          />
        </FormField>
        <FormField id="cohort-cycle" label="Cycle">
          <FloatingSelect
            id="cohort-cycle"
            value={form.cycleId}
            options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
            onChange={form.setCycleId}
            placeholder="Choose a cycle"
            disabled={form.submissionComplete}
          />
        </FormField>
      </form>
    </Modal>
  );
}
